const { query } = require("../config/database");

async function getTotalMessages() {
  const rows = await query("SELECT COUNT(*) AS total FROM messages");
  return Number(rows[0]?.total || 0);
}

async function getMessagesPerUser() {
  return query(
    `SELECT u.id AS userId, u.name, u.email, COUNT(m.id) AS totalMessages
     FROM users u
     LEFT JOIN messages m ON m.user_id = u.id
     GROUP BY u.id, u.name, u.email
     ORDER BY totalMessages DESC`
  );
}

async function getMessagesPerDay(days = 30) {
  return query(
    `SELECT DATE(created_at) AS date, COUNT(*) AS totalMessages
     FROM messages
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY DATE(created_at)
     ORDER BY date DESC`,
    [days]
  );
}

async function getMessageOverview() {
  const rows = await query(
    `SELECT
        SUM(CASE WHEN message_status = 'SENT' THEN 1 ELSE 0 END) AS totalSent,
        SUM(CASE
              WHEN message_status = 'SENT'
               AND YEAR(created_at) = YEAR(CURDATE())
               AND MONTH(created_at) = MONTH(CURDATE())
              THEN 1 ELSE 0 END) AS sentThisMonth,
        SUM(CASE WHEN message_status = 'FAILED' THEN 1 ELSE 0 END) AS totalFailed
     FROM messages`
  );

  return {
    totalSent: Number(rows[0]?.totalSent || 0),
    sentThisMonth: Number(rows[0]?.sentThisMonth || 0),
    totalFailed: Number(rows[0]?.totalFailed || 0)
  };
}

module.exports = {
  getTotalMessages,
  getMessagesPerUser,
  getMessagesPerDay,
  getMessageOverview
};
