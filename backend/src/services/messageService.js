const clientRepository = require("../repositories/clientRepository");
const messageRepository = require("../repositories/messageRepository");
const numberCheckRepository = require("../repositories/numberCheckRepository");
const { clientManager } = require("../baileys/clientManager");
const { ApiError } = require("../utils/ApiError");
const { CLIENT_STATUS, MESSAGE_STATUS, MESSAGE_TYPE } = require("../utils/constants");
const { logger } = require("../config/logger");

const AVAILABLE_NUMBER_CACHE_MONTHS = 6;
const UNAVAILABLE_NUMBER_CACHE_DAYS = 15;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForManagedClient(userId, attempts = 8, delayMs = 500) {
  for (let i = 0; i < attempts; i += 1) {
    const managed = clientManager.getClientByUserId(userId);
    const latestClient = await clientRepository.findByUserId(userId);
    if (managed?.sock && latestClient?.status === CLIENT_STATUS.READY) {
      return managed;
    }
    await sleep(delayMs);
  }
  return null;
}

function cleanRecipientNumber(number) {
  return String(number).replace(/[^0-9]/g, "");
}

function getNumberCheckExpiry(isOnWhatsapp) {
  const expiresAt = new Date();
  if (isOnWhatsapp) {
    expiresAt.setMonth(expiresAt.getMonth() + AVAILABLE_NUMBER_CACHE_MONTHS);
  } else {
    expiresAt.setDate(expiresAt.getDate() + UNAVAILABLE_NUMBER_CACHE_DAYS);
  }
  return expiresAt;
}

async function checkRecipientAvailability({ userId, sock, recipientNumber }) {
  const clean = cleanRecipientNumber(recipientNumber);
  const cached = await numberCheckRepository.findValidByUserAndPhone(userId, clean);
  if (cached) {
    return {
      exists: Boolean(cached.isOnWhatsapp),
      jid: cached.whatsappJid || `${clean}@s.whatsapp.net`,
      source: "cache"
    };
  }

  const fallbackJid = `${clean}@s.whatsapp.net`;
  let lookup;
  try {
    lookup = await sock.onWhatsApp(fallbackJid);
  } catch (err) {
    logger.error({ err, recipientNumber }, "WhatsApp number availability check failed");
    throw new ApiError(500, "Could not verify whether the recipient number is on WhatsApp.", {
      code: "NUMBER_CHECK_FAILED",
      recipientNumber
    });
  }

  const match = Array.isArray(lookup) ? lookup.find((item) => item?.exists) : null;
  const exists = Boolean(match);
  const jid = exists ? match.jid : null;

  await numberCheckRepository.upsertCheck({
    userId,
    phoneNumber: clean,
    whatsappJid: jid,
    isOnWhatsapp: exists,
    expiresAt: getNumberCheckExpiry(exists)
  });

  const payload = {
    exists,
    jid: jid || fallbackJid,
    source: "whatsapp_lookup"
  };

  return payload;
}

async function ensureRecipientAvailable({ userId, sock, recipientNumber, messageLogId }) {
  const availability = await checkRecipientAvailability({ userId, sock, recipientNumber });
  if (availability.exists) {
    return availability.jid;
  }

  if (messageLogId) {
    await messageRepository.updateMessageStatus(messageLogId, MESSAGE_STATUS.FAILED);
  }

  throw new ApiError(422, "The recipient number is not registered on WhatsApp.", {
    code: "NUMBER_NOT_ON_WHATSAPP",
    recipientNumber
  });
}

function getErrorMessage(err) {
  return (
    err?.message ||
    err?.output?.payload?.message ||
    err?.data?.message ||
    "WhatsApp send failed"
  );
}

function classifyKnownSendFailure(err, messageType) {
  const rawMessage = getErrorMessage(err);
  const message = rawMessage.toLowerCase();

  if (
    messageType === MESSAGE_TYPE.IMAGE &&
    (
      message.includes("fetch") ||
      message.includes("invalid url") ||
      message.includes("unsupported") ||
      message.includes("media") ||
      message.includes("enotfound") ||
      message.includes("econnrefused") ||
      message.includes("timeout") ||
      message.includes("404") ||
      message.includes("403")
    )
  ) {
    return {
      statusCode: 422,
      code: "IMAGE_FETCH_FAILED",
      message: "The image could not be downloaded or sent by the WhatsApp bot server."
    };
  }

  if (
    message.includes("connection") ||
    message.includes("socket") ||
    message.includes("not open") ||
    message.includes("closed") ||
    message.includes("logged out") ||
    message.includes("timed out")
  ) {
    return {
      statusCode: 409,
      code: "WHATSAPP_CONNECTION_ERROR",
      message: "WhatsApp client connection was lost while sending the message."
    };
  }

  return null;
}

function classifySendFailure({ recipientNumber, err, messageType }) {
  const knownFailure = classifyKnownSendFailure(err, messageType);
  if (knownFailure) {
    return {
      ...knownFailure,
      diagnostic: getErrorMessage(err)
    };
  }

  return {
    statusCode: 500,
    code: "WHATSAPP_SEND_FAILED",
    message: "WhatsApp rejected the message after the number availability check passed.",
    recipientNumber,
    diagnostic: getErrorMessage(err)
  };
}

function throwSendFailure({ recipientNumber, err, messageType }) {
  const failure = classifySendFailure({
    recipientNumber,
    err,
    messageType
  });

  throw new ApiError(failure.statusCode, failure.message, {
    code: failure.code,
    recipientNumber: failure.recipientNumber || recipientNumber,
    diagnostic: failure.diagnostic
  });
}

async function ensureReadyClient(userId) {
  const client = await clientRepository.findByUserId(userId);
  if (!client) {
    throw new ApiError(404, "Client not found. Create a client first.", {
      code: "CLIENT_NOT_FOUND"
    });
  }

  if (client.status !== CLIENT_STATUS.READY) {
    throw new ApiError(409, "Client is not READY. Complete WhatsApp login first.", {
      code: "CLIENT_NOT_READY",
      status: client.status
    });
  }

  let managed = clientManager.getClientByUserId(userId);
  if (!managed?.sock) {
    // After server restart, revive the in-memory socket from saved session files.
    logger.warn({ userId, clientId: client.id }, "Recovering WhatsApp client from session");

    try {
      await clientManager.initClient(userId, client.id, client.sessionPath, { allowPairing: false });
      managed = await waitForManagedClient(userId, 16, 500);
    } catch (err) {
      logger.error({ err, userId, clientId: client.id }, "Client session recovery failed");
      throw new ApiError(409, "Client recovery failed. Open Client Setup and reconnect.", {
        code: "CLIENT_RECOVERY_FAILED"
      });
    }
  }

  if (!managed?.sock) {
    throw new ApiError(409, "Client recovery in progress. Wait for READY and try again.", {
      code: "CLIENT_RECOVERY_IN_PROGRESS"
    });
  }

  return { client, sock: managed.sock };
}

async function sendTextMessage({ userId, recipientNumber, messageText, sourceApplication }) {
  const { client, sock } = await ensureReadyClient(userId);

  const messageLog = await messageRepository.createMessage({
    userId,
    clientId: client.id,
    recipientNumber,
    messageType: MESSAGE_TYPE.TEXT,
    content: { text: messageText },
    sourceApplication,
    messageStatus: MESSAGE_STATUS.PENDING
  });

  try {
    const jid = await ensureRecipientAvailable({
      userId,
      sock,
      recipientNumber,
      messageLogId: messageLog.id
    });
    const result = await sock.sendMessage(jid, { text: messageText });

    await messageRepository.updateMessageStatus(messageLog.id, MESSAGE_STATUS.SENT);

    return {
      messageId: messageLog.id,
      status: MESSAGE_STATUS.SENT,
      whatsappMessageId: result.key.id
    };
  } catch (err) {
    await messageRepository.updateMessageStatus(messageLog.id, MESSAGE_STATUS.FAILED);
    if (err instanceof ApiError) {
      throw err;
    }

    logger.error({ err, userId, recipientNumber }, "Text message send failed");
    throwSendFailure({
      recipientNumber,
      err,
      messageType: MESSAGE_TYPE.TEXT
    });
  }
}

async function sendImageMessage({ userId, recipientNumber, imageUrl, caption, sourceApplication }) {
  const { client, sock } = await ensureReadyClient(userId);

  const messageLog = await messageRepository.createMessage({
    userId,
    clientId: client.id,
    recipientNumber,
    messageType: MESSAGE_TYPE.IMAGE,
    content: { imageUrl, caption: caption || "" },
    sourceApplication,
    messageStatus: MESSAGE_STATUS.PENDING
  });

  try {
    const jid = await ensureRecipientAvailable({
      userId,
      sock,
      recipientNumber,
      messageLogId: messageLog.id
    });
    const result = await sock.sendMessage(jid, {
      image: { url: imageUrl },
      caption: caption || ""
    });

    await messageRepository.updateMessageStatus(messageLog.id, MESSAGE_STATUS.SENT);

    return {
      messageId: messageLog.id,
      status: MESSAGE_STATUS.SENT,
      whatsappMessageId: result.key.id
    };
  } catch (err) {
    await messageRepository.updateMessageStatus(messageLog.id, MESSAGE_STATUS.FAILED);
    if (err instanceof ApiError) {
      throw err;
    }

    logger.error({ err, userId, recipientNumber }, "Image message send failed");
    throwSendFailure({
      recipientNumber,
      err,
      messageType: MESSAGE_TYPE.IMAGE
    });
  }
}

async function getUserMessages(userId, limit = 100) {
  return messageRepository.getMessagesByUser(userId, limit);
}

async function getUserMessageStats(userId) {
  return messageRepository.getUserMessageStats(userId);
}

module.exports = {
  sendTextMessage,
  sendImageMessage,
  getUserMessages,
  getUserMessageStats
};
