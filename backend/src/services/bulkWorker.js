const { query } = require("../config/database");
const messageService = require("./messageService");
const { logger } = require("../config/logger");

let workerInterval = null;
let isProcessingQueue = false;
let lastTerminalMessageCleanupAt = 0;
const TERMINAL_MESSAGE_RETENTION_DAYS = 3;
const CLEANUP_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const STALE_SENDING_MINUTES = 10;

function getBulkSendErrorMessage(error) {
  const message = error?.message || "WhatsApp send failed.";
  const code = error?.details?.code;
  const diagnostic = error?.details?.diagnostic;
  const details = [];

  if (code) details.push(`Code: ${code}`);
  if (diagnostic && diagnostic !== message) details.push(`Reason: ${diagnostic}`);

  return details.length > 0 ? `${message} (${details.join(". ")})` : message;
}

async function cleanupExpiredTerminalMessages() {
  const now = Date.now();
  if (now - lastTerminalMessageCleanupAt < CLEANUP_CHECK_INTERVAL_MS) return;

  lastTerminalMessageCleanupAt = now;
  const result = await query(`
    DELETE FROM bulk_message_queue
    WHERE status IN ('SENT', 'FAILED')
      AND updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)
  `, [TERMINAL_MESSAGE_RETENTION_DAYS]);

  if (result.affectedRows > 0) {
    logger.info({ deletedCount: result.affectedRows }, "Deleted expired bulk message records");
  }
}

const startWorker = () => {
  if (workerInterval) return;
  // Run every 5 seconds
  workerInterval = setInterval(processQueue, 5000);
  logger.info("Bulk messaging background worker started");
};

const stopWorker = () => {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
};

const processQueue = async () => {
  if (isProcessingQueue) {
    logger.debug("Skipping bulk worker tick because the previous tick is still running");
    return;
  }

  isProcessingQueue = true;

  try {
    await cleanupExpiredTerminalMessages();

    // 1. Find all active users whose next_send_time is null or in the past
    const activeUsers = await query(`
      SELECT user_id, send_interval_min_minutes, send_interval_max_minutes
      FROM bulk_queue_status 
      WHERE status = 'ACTIVE' 
      AND (next_send_time IS NULL OR next_send_time <= NOW())
    `);

    if (!activeUsers || activeUsers.length === 0) {
      return;
    }

    // 2. Process one message for each active user concurrently
    const promises = activeUsers.map(user => processNextMessageForUser(user.user_id, user.send_interval_min_minutes, user.send_interval_max_minutes));
    await Promise.allSettled(promises);
  } catch (error) {
    logger.error({ err: error }, "Error in bulk worker processQueue");
  } finally {
    isProcessingQueue = false;
  }
};

const processNextMessageForUser = async (userId, minMins = 1, maxMins = 1) => {
  try {
    // Check expiry
    const userRows = await query('SELECT message_expiry_date FROM users WHERE id = ?', [userId]);
    const messageExpiryDate = userRows[0]?.message_expiry_date;
    if (!messageExpiryDate || new Date(messageExpiryDate) < new Date()) {
      await query(`UPDATE bulk_queue_status SET status = 'PAUSED' WHERE user_id = ?`, [userId]);
      return;
    }

    await query(`
      UPDATE bulk_message_queue
      SET status = 'PENDING', error_message = NULL
      WHERE user_id = ?
        AND status = 'SENDING'
        AND updated_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)
    `, [userId, STALE_SENDING_MINUTES]);

    // Lock the next message to prevent double sending
    const updateResult = await query(`
      UPDATE bulk_message_queue 
      SET status = 'SENDING' 
      WHERE user_id = ? AND status = 'PENDING' 
      ORDER BY id ASC LIMIT 1
    `, [userId]);

    if (updateResult.affectedRows === 0) {
      // Queue is empty, pause the user automatically
      await query(`UPDATE bulk_queue_status SET status = 'PAUSED' WHERE user_id = ?`, [userId]);
      return;
    }

    const lockedMessages = await query(`
      SELECT id, recipient_number, message_text, media_url, caption 
      FROM bulk_message_queue 
      WHERE user_id = ? AND status = 'SENDING' 
      ORDER BY id ASC LIMIT 1
    `, [userId]);

    if (!lockedMessages || lockedMessages.length === 0) {
      return;
    }

    const msg = lockedMessages[0];

    // Attempt to send
    try {
      if (msg.media_url) {
        await messageService.sendImageMessage({
          userId,
          recipientNumber: msg.recipient_number,
          imageUrl: msg.media_url,
          caption: msg.caption,
          sourceApplication: "Bulk Sender"
        });
      } else {
        await messageService.sendTextMessage({
          userId,
          recipientNumber: msg.recipient_number,
          messageText: msg.message_text,
          sourceApplication: "Bulk Sender"
        });
      }

      await query(`UPDATE bulk_message_queue SET status = 'SENT' WHERE id = ?`, [msg.id]);
    } catch (sendError) {
      logger.error({ err: sendError, msgId: msg.id }, "Failed to send bulk message");
      await query(`UPDATE bulk_message_queue SET status = 'FAILED', error_message = ? WHERE id = ?`, [getBulkSendErrorMessage(sendError), msg.id]);
    }

    // Each user controls their own delay in whole minutes.
    const min = Math.min(Math.max(Number.parseInt(minMins, 10) || 1, 1), 1440);
    const max = Math.min(Math.max(Number.parseInt(maxMins, 10) || min, min), 1440);
    
    // Choose a random interval between min and max (inclusive of min, up to max)
    const intervalMinutes = min + Math.random() * (max - min);
    
    // Add optional random "rest periods" — e.g. every 10th message add an extra 2-5 minutes
    let delaySeconds = intervalMinutes * 60;
    if (Math.random() < 0.1) { // 10% chance for a rest period
      delaySeconds += (120 + Math.random() * 180); // add 2-5 minutes
    }
    
    await query(`UPDATE bulk_queue_status SET next_send_time = DATE_ADD(NOW(), INTERVAL ? SECOND) WHERE user_id = ?`, [Math.round(delaySeconds), userId]);

  } catch (error) {
    logger.error({ err: error, userId }, "Error processing message for user in bulk worker");
  }
};

module.exports = {
  startWorker,
  stopWorker,
  processQueue,
  cleanupExpiredTerminalMessages
};
