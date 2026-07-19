const { query } = require("../config/database");

async function createClient({ userId, status, sessionPath }) {
  const result = await query(
    `INSERT INTO clients (user_id, status, session_path)
     VALUES (?, ?, ?)`,
    [userId, status, sessionPath]
  );

  return { id: result.insertId, userId, status, sessionPath };
}

async function findByUserId(userId) {
  const rows = await query(
    `SELECT id, user_id AS userId, status, session_path AS sessionPath, created_at AS createdAt
     FROM clients WHERE user_id = ? LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

async function findById(id) {
  const rows = await query(
    `SELECT id, user_id AS userId, status, session_path AS sessionPath, created_at AS createdAt
     FROM clients WHERE id = ? LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function updateStatusByUserId(userId, status) {
  await query("UPDATE clients SET status = ? WHERE user_id = ?", [status, userId]);
  return findByUserId(userId);
}

async function deleteByUserId(userId) {
  const result = await query("DELETE FROM clients WHERE user_id = ?", [userId]);
  return result.affectedRows > 0;
}

async function countActiveClients() {
  const rows = await query(
    `SELECT COUNT(*) AS total
     FROM clients
     WHERE status = 'READY'`
  );
  return Number(rows[0]?.total || 0);
}

async function listRecoverableClients() {
  return query(
    `SELECT id, user_id AS userId, status, session_path AS sessionPath, created_at AS createdAt
     FROM clients
     WHERE status = 'READY'
       AND session_path IS NOT NULL`
  );
}

module.exports = {
  createClient,
  findByUserId,
  findById,
  updateStatusByUserId,
  deleteByUserId,
  countActiveClients,
  listRecoverableClients
};
