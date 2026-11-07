const { createHash } = require("node:crypto");

const DEFAULT_RETENTION_SECONDS = 7 * 24 * 60 * 60;

function readRetryRetentionSeconds(raw = process.env.WA_RETRY_RETENTION_SECONDS) {
  if (raw === undefined || String(raw).trim() === "") {
    return DEFAULT_RETENTION_SECONDS;
  }
  const seconds = Number(raw);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error("WA_RETRY_RETENTION_SECONDS must be a positive integer in seconds");
  }
  return seconds;
}

function createMessageRetryStore({
  userId,
  clientId,
  identityKey,
  repository,
  proto,
  jidNormalizedUser,
  resolvePhoneNumber,
  logger,
  retentionSeconds = DEFAULT_RETENTION_SECONDS
}) {
  if (!identityKey?.length) {
    throw new Error("WhatsApp identity key is required for retry storage");
  }
  if (!Number.isSafeInteger(retentionSeconds) || retentionSeconds <= 0) {
    throw new Error("WhatsApp retry retention must be a positive integer in seconds");
  }

  // The public identity survives reconnects/restarts and changes on a fresh pairing.
  const sessionId = createHash("sha256").update(identityKey).digest("hex");
  const scope = { userId, clientId, sessionId };

  async function matchesChat(storedJid, requestedJid) {
    if (!storedJid || !requestedJid) {
      return false;
    }
    const stored = jidNormalizedUser(storedJid);
    const requested = jidNormalizedUser(requestedJid);
    if (stored === requested) {
      return true;
    }

    // PN and LID values are different namespaces. Verify the pair with WhatsApp
    // instead of assuming equal numeric parts identify the same person.
    const pn = [stored, requested].find((jid) => jid.endsWith("@s.whatsapp.net"));
    const lid = [stored, requested].find((jid) => jid.endsWith("@lid"));
    if (!pn || !lid || !resolvePhoneNumber) {
      return false;
    }
    const matches = await resolvePhoneNumber(pn);
    return Boolean(matches?.some((match) => (
      match.exists && match.jid && match.lid &&
      jidNormalizedUser(match.jid) === pn && jidNormalizedUser(match.lid) === lid
    )));
  }

  return {
    async saveMessage(message, messageLogId) {
      const { key, message: content } = message || {};
      if (!key?.id || !key.remoteJid || key.fromMe !== true || !content ||
          !Object.keys(content).length || !messageLogId) {
        throw new Error("Cannot persist an incomplete outgoing WhatsApp message for retry");
      }
      const payload = Buffer.from(proto.Message.encode(content).finish());
      try {
        await repository.save({
          ...scope,
          messageId: key.id,
          remoteJid: jidNormalizedUser(key.remoteJid),
          messageLogId,
          payload,
          retentionSeconds
        });
      } catch (err) {
        // Driver errors can contain the full SQL, including the sensitive BLOB.
        logger.error(
          { userId, clientId, whatsappMessageId: key.id, errorCode: err.code || err.name },
          "Persisting WhatsApp retry payload failed"
        );
        const failure = new Error("Message was not sent because WhatsApp retry storage is unavailable");
        failure.code = "WHATSAPP_RETRY_STORAGE_FAILED";
        throw failure;
      }
    },

    async getMessage(key) {
      if (!key?.id || !key.remoteJid || key.fromMe === false) {
        return undefined;
      }
      const diagnostic = { userId, clientId, whatsappMessageId: key.id };
      try {
        const stored = await repository.find({ ...scope, messageId: key.id });
        if (!stored) {
          logger.warn(diagnostic, "WhatsApp retry payload missing or expired");
          return undefined;
        }
        if (!await matchesChat(stored.remoteJid, key.remoteJid)) {
          logger.warn(diagnostic, "WhatsApp retry chat identity did not match");
          return undefined;
        }
        const message = proto.Message.decode(stored.payload);
        if (!Object.keys(message).length) {
          throw new Error("Stored WhatsApp retry payload is empty");
        }
        logger.info(diagnostic, "WhatsApp retry payload found");
        return message;
      } catch (err) {
        // Return no message on failure; an invented empty message burns the retry.
        logger.error({ ...diagnostic, errorCode: err.code || err.name }, "WhatsApp retry lookup failed");
        return undefined;
      }
    }
  };
}

module.exports = { createMessageRetryStore, DEFAULT_RETENTION_SECONDS, readRetryRetentionSeconds };
