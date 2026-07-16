const { query } = require("../config/database");
const messageService = require("./messageService");
const { logger } = require("../config/logger");

let workerInterval = null;
let lastTerminalMessageCleanupAt = 0;
const TERMINAL_MESSAGE_RETENTION_DAYS = 3;
const CLEANUP_CHECK_INTERVAL_MS = 60 * 60 * 1000;

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
      AND updated_at < DATE_SUB(NOW(), INTERVAL ${TERMINAL_MESSAGE_RETENTION_DAYS} DAY)
  `);

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
  try {
    await cleanupExpiredTerminalMessages();

    // 1. Find all active users whose next_send_time is null or in the past
    const activeUsers = await query(`
      SELECT user_id 
      FROM bulk_queue_status 
      WHERE status = 'ACTIVE' 
      AND (next_send_time IS NULL OR next_send_time <= NOW())
    `);

    if (!activeUsers || activeUsers.length === 0) {
      return;
    }

    // 2. Process one message for each active user concurrently
    const promises = activeUsers.map(user => processNextMessageForUser(user.user_id));
    await Promise.allSettled(promises);
  } catch (error) {
    logger.error({ err: error }, "Error in bulk worker processQueue");
  }
};

const processNextMessageForUser = async (userId) => {
  try {
    // Lock the next message to prevent double sending (in a simpler implementation we just fetch 1 pending)
    const pendingMessages = await query(`
      SELECT id, recipient_number, message_text, media_url, caption 
      FROM bulk_message_queue 
      WHERE user_id = ? AND status = 'PENDING' 
      ORDER BY id ASC LIMIT 1
    `, [userId]);

    if (!pendingMessages || pendingMessages.length === 0) {
      // Queue is empty, pause the user automatically
      await query(`UPDATE bulk_queue_status SET status = 'PAUSED' WHERE user_id = ?`, [userId]);
      return;
    }

    const msg = pendingMessages[0];

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

    // Set next send time between 45s and 60s
    const delaySeconds = Math.floor(Math.random() * (60 - 45 + 1)) + 45;
    await query(`UPDATE bulk_queue_status SET next_send_time = DATE_ADD(NOW(), INTERVAL ? SECOND) WHERE user_id = ?`, [delaySeconds, userId]);

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
