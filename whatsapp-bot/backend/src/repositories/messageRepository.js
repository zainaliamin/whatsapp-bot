const { query } = require("../config/database");

async function createMessage(payload) {
  const result = await query(
    `INSERT INTO messages (
      user_id,
      client_id,
      recipient_number,
      message_type,
      content,
      source_application,
      message_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.userId,
      payload.clientId,
      payload.recipientNumber,
      payload.messageType,
      JSON.stringify(payload.content),
      payload.sourceApplication,
      payload.messageStatus
    ]
  );

  return { id: result.insertId, ...payload };
}

async function updateMessageStatus(messageId, status) {
  await query("UPDATE messages SET message_status = ? WHERE id = ?", [status, messageId]);
}

async function getMessagesByUser(userId, limit = 100) {
  const safeLimit = Number.isFinite(Number(limit)) ? Number(limit) : 100;
  const boundedLimit = Math.min(Math.max(Math.trunc(safeLimit), 1), 500);

  const rows = await query(
    `SELECT id,
            user_id AS userId,
            client_id AS clientId,
            recipient_number AS recipientNumber,
            message_type AS messageType,
            content,
            source_application AS sourceApplication,
            message_status AS messageStatus,
            created_at AS createdAt
     FROM messages
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ${boundedLimit}`,
    [userId]
  );

  return rows.map((row) => ({
    ...row,
    content: typeof row.content === "string" ? JSON.parse(row.content) : row.content
  }));
}

async function getUserMessageStats(userId) {
  const rows = await query(
    `SELECT
        SUM(CASE WHEN message_status = 'SENT' THEN 1 ELSE 0 END) AS totalSent,
        SUM(CASE
              WHEN YEAR(created_at) = YEAR(CURDATE())
               AND MONTH(created_at) = MONTH(CURDATE())
               AND message_status = 'SENT'
              THEN 1 ELSE 0 END) AS thisMonth,
        SUM(CASE
              WHEN DATE(created_at) = CURDATE()
               AND message_status = 'SENT'
              THEN 1 ELSE 0 END) AS today
     FROM messages
     WHERE user_id = ?`,
    [userId]
  );

  return {
    totalSent: Number(rows[0]?.totalSent || 0),
    thisMonth: Number(rows[0]?.thisMonth || 0),
    today: Number(rows[0]?.today || 0)
  };
}

module.exports = {
  createMessage,
  updateMessageStatus,
  getMessagesByUser,
  getUserMessageStats
};
