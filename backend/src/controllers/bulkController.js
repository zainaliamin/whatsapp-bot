const { query } = require("../config/database");
const { asyncHandler } = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/response");

const enqueue = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { messages } = req.body; // Array of { recipientNumber, messageText, mediaUrl, caption }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return sendError(res, "Messages array is required", 400);
  }

  // Insert messages into queue
  const values = messages.map(msg => [
    userId,
    msg.recipientNumber,
    msg.messageText || null,
    msg.mediaUrl || null,
    msg.caption || null,
    'PENDING'
  ]);

  // Insert messages into queue in chunks to avoid MySQL placeholder limits (max 65,535)
  const chunkSize = 1000;
  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
    const flatValues = chunk.flat();

    await query(`
      INSERT INTO bulk_message_queue (user_id, recipient_number, message_text, media_url, caption, status)
      VALUES ${placeholders}
    `, flatValues);
  }

  // Set user queue status to ACTIVE and reset next_send_time so it starts immediately
  await query(`
    INSERT INTO bulk_queue_status (user_id, status, next_send_time)
    VALUES (?, 'ACTIVE', NOW())
    ON DUPLICATE KEY UPDATE status = 'ACTIVE', next_send_time = NOW()
  `, [userId]);

  return sendSuccess(res, "Messages added to queue", { count: messages.length }, 201);
});

const getStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const statsQuery = await query(`
    SELECT status, COUNT(*) as count 
    FROM bulk_message_queue 
    WHERE user_id = ? 
    GROUP BY status
  `, [userId]);

  const stats = {
    PENDING: 0,
    SENT: 0,
    FAILED: 0
  };

  statsQuery.forEach(row => {
    if (stats[row.status] !== undefined) {
      stats[row.status] = row.count;
    }
  });

  const statusQuery = await query(`
    SELECT status, next_send_time 
    FROM bulk_queue_status 
    WHERE user_id = ?
  `, [userId]);

  const queueStatus = statusQuery.length > 0 ? statusQuery[0].status : 'PAUSED';
  const nextSendTime = statusQuery.length > 0 ? statusQuery[0].next_send_time : null;

  return sendSuccess(res, "Bulk stats fetched", {
    queueStatus,
    nextSendTime,
    ...stats
  });
});

const setStatus = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { status } = req.body; // 'ACTIVE' or 'PAUSED'

  if (status !== 'ACTIVE' && status !== 'PAUSED') {
    return sendError(res, "Invalid status", 400);
  }

  await query(`
    INSERT INTO bulk_queue_status (user_id, status)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE status = ?
  `, [userId, status, status]);

  return sendSuccess(res, `Queue status set to ${status}`);
});

const clearPending = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const result = await query(`
    DELETE FROM bulk_message_queue 
    WHERE user_id = ? AND status = 'PENDING'
  `, [userId]);

  // Pause queue as well
  await query(`
    UPDATE bulk_queue_status SET status = 'PAUSED' WHERE user_id = ?
  `, [userId]);

  return sendSuccess(res, "Pending queue cleared", { deletedCount: result.affectedRows });
});

module.exports = {
  enqueue,
  getStats,
  setStatus,
  clearPending
};
