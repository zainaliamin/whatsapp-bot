function createMessageRetryRepository(query) {
  return {
    async assertReady() {
      try {
        await query(
          `SELECT user_id, client_id, session_id, whatsapp_message_id, remote_jid,
                  message_log_id, message_payload, created_at, expires_at
           FROM whatsapp_message_retries LIMIT 0`
        );
      } catch (err) {
        if (err.code === "ER_NO_SUCH_TABLE") {
          throw new Error(
            "WhatsApp retry storage is missing. Apply database/migrations/20261107_add_whatsapp_message_retries.sql before starting the backend.",
            { cause: err }
          );
        }
        if (err.code === "ER_BAD_FIELD_ERROR") {
          throw new Error(
            "WhatsApp retry storage has an incomplete table schema. Compare whatsapp_message_retries with database/migrations/20261107_add_whatsapp_message_retries.sql and add the missing columns before starting the backend.",
            { cause: err }
          );
        }
        throw err;
      }
    },

    async save({ userId, clientId, sessionId, messageId, remoteJid, messageLogId, payload, retentionSeconds }) {
      await query(
        `INSERT INTO whatsapp_message_retries (
          user_id, client_id, session_id, whatsapp_message_id,
          remote_jid, message_log_id, message_payload, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
        [userId, clientId, sessionId, messageId, remoteJid, messageLogId, payload, retentionSeconds]
      );
    },

    async find({ userId, clientId, sessionId, messageId }) {
      const rows = await query(
        `SELECT remote_jid AS remoteJid, message_payload AS payload
         FROM whatsapp_message_retries
         WHERE user_id = ? AND client_id = ? AND session_id = ?
           AND whatsapp_message_id = ? AND expires_at > NOW()
         LIMIT 1`,
        [userId, clientId, sessionId, messageId]
      );
      return rows[0];
    },

    async deleteExpired() {
      const result = await query(
        "DELETE FROM whatsapp_message_retries WHERE expires_at <= NOW() LIMIT 1000"
      );
      return result.affectedRows;
    }
  };
}

const { query } = require("../config/database");

module.exports = {
  ...createMessageRetryRepository(query),
  createMessageRetryRepository
};
