const clientRepository = require("../repositories/clientRepository");
const messageRepository = require("../repositories/messageRepository");
const { clientManager } = require("../baileys/clientManager");
const { ApiError } = require("../utils/ApiError");
const { CLIENT_STATUS, MESSAGE_STATUS, MESSAGE_TYPE } = require("../utils/constants");
const { logger } = require("../config/logger");

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

function normalizeRecipient(number) {
  const clean = String(number).replace(/[^0-9]/g, "");
  return `${clean}@s.whatsapp.net`;
}

async function ensureReadyClient(userId) {
  const client = await clientRepository.findByUserId(userId);
  if (!client) {
    throw new ApiError(404, "Client not found. Create a client first.");
  }

  if (client.status !== CLIENT_STATUS.READY) {
    throw new ApiError(409, "Client is not READY. Complete WhatsApp login first.");
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
      throw new ApiError(409, "Client recovery failed. Open Client Setup and reconnect.");
    }
  }

  if (!managed?.sock) {
    throw new ApiError(409, "Client recovery in progress. Wait for READY and try again.");
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
    const jid = normalizeRecipient(recipientNumber);
    const result = await sock.sendMessage(jid, { text: messageText });

    await messageRepository.updateMessageStatus(messageLog.id, MESSAGE_STATUS.SENT);

    return {
      messageId: messageLog.id,
      status: MESSAGE_STATUS.SENT,
      whatsappMessageId: result.key.id
    };
  } catch (err) {
    await messageRepository.updateMessageStatus(messageLog.id, MESSAGE_STATUS.FAILED);
    logger.error({ err, userId, recipientNumber }, "Text message send failed");
    throw new ApiError(500, "Failed to send text message");
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
    const jid = normalizeRecipient(recipientNumber);
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
    logger.error({ err, userId, recipientNumber }, "Image message send failed");
    throw new ApiError(500, "Failed to send image message");
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
