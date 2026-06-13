const { query } = require("../config/database");

async function createUser({ name, email, password, role = "user", messageExpiryDate = null }) {
  const result = await query(
    `INSERT INTO users (name, email, password, role, message_expiry_date)
     VALUES (?, ?, ?, ?, ?)`,
    [name, email, password, role, messageExpiryDate]
  );

  return { id: result.insertId, name, email, role, messageExpiryDate };
}

async function findByEmail(email) {
  const rows = await query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
  return rows[0] || null;
}

async function findById(id) {
  const rows = await query("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
}

async function listUsers() {
  return query(
    `SELECT
       u.id,
       u.name,
       u.email,
       u.role,
       u.message_expiry_date AS messageExpiryDate,
       u.created_at AS createdAt,
       COUNT(m.id) AS totalMessages
     FROM users u
     LEFT JOIN messages m ON m.user_id = u.id
     GROUP BY u.id, u.name, u.email, u.role, u.message_expiry_date, u.created_at
     ORDER BY u.created_at DESC`
  );
}

async function deleteUser(id) {
  const result = await query("DELETE FROM users WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

async function updateUser(id, updates) {
  const fields = [];
  const values = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }

  if (updates.email !== undefined) {
    fields.push("email = ?");
    values.push(updates.email);
  }

  if (updates.password !== undefined) {
    fields.push("password = ?");
    values.push(updates.password);
  }

  if (updates.role !== undefined) {
    fields.push("role = ?");
    values.push(updates.role);
  }

  if (updates.messageExpiryDate !== undefined) {
    fields.push("message_expiry_date = ?");
    values.push(updates.messageExpiryDate);
  }

  if (!fields.length) {
    return findById(id);
  }

  values.push(id);
  await query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);
  return findById(id);
}

module.exports = {
  createUser,
  findByEmail,
  findById,
  listUsers,
  deleteUser,
  updateUser
};
