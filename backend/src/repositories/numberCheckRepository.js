const { query } = require("../config/database");

async function findValidByUserAndPhone(userId, phoneNumber) {
  const rows = await query(
    `SELECT id,
            user_id AS userId,
            phone_number AS phoneNumber,
            whatsapp_jid AS whatsappJid,
            is_on_whatsapp AS isOnWhatsapp,
            checked_at AS checkedAt,
            expires_at AS expiresAt
     FROM whatsapp_number_checks
     WHERE user_id = ?
       AND phone_number = ?
       AND expires_at > NOW()
     LIMIT 1`,
    [userId, phoneNumber]
  );

  return rows[0] || null;
}

async function upsertCheck({ userId, phoneNumber, whatsappJid, isOnWhatsapp, expiresAt }) {
  await query(
    `INSERT INTO whatsapp_number_checks (
       user_id,
       phone_number,
       whatsapp_jid,
       is_on_whatsapp,
       checked_at,
       expires_at
     ) VALUES (?, ?, ?, ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE
       whatsapp_jid = VALUES(whatsapp_jid),
       is_on_whatsapp = VALUES(is_on_whatsapp),
       checked_at = NOW(),
       expires_at = VALUES(expires_at)`,
    [userId, phoneNumber, whatsappJid, isOnWhatsapp ? 1 : 0, expiresAt]
  );

  return {
    userId,
    phoneNumber,
    whatsappJid,
    isOnWhatsapp,
    expiresAt
  };
}

module.exports = {
  findValidByUserAndPhone,
  upsertCheck
};
