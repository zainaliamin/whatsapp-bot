const { query } = require("../config/database");

async function upsertToken(userId, token) {
  await query(
    `INSERT INTO api_tokens (user_id, token)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE token = VALUES(token), created_at = CURRENT_TIMESTAMP`,
    [userId, token]
  );

  return { userId, token };
}

async function findByUserId(userId) {
  const rows = await query(
    `SELECT id, user_id AS userId, token, created_at AS createdAt
     FROM api_tokens
     WHERE user_id = ?
     LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

async function findByToken(token) {
  const rows = await query(
    `SELECT t.id, t.user_id AS userId, t.token, t.created_at AS createdAt,
            u.name, u.email, u.role, u.message_expiry_date AS messageExpiryDate
     FROM api_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.token = ?
     LIMIT 1`,
    [token]
  );

  return rows[0] || null;
}

async function deleteByUserId(userId) {
  const result = await query("DELETE FROM api_tokens WHERE user_id = ?", [userId]);
  return result.affectedRows > 0;
}

module.exports = {
  upsertToken,
  findByUserId,
  findByToken,
  deleteByUserId
};
