const http = require("http");
const { app } = require("./src/app");
const { initSocketServer } = require("./src/sockets/socketServer");
const { logger } = require("./src/config/logger");
const { query } = require("./src/config/database");
const { ensureDefaultAdmin } = require("./src/services/bootstrapService");
const { clientManager } = require("./src/baileys/clientManager");
const { startWorker, stopWorker } = require("./src/services/bulkWorker");
const { pool } = require("./src/config/database");
const messageRetryRepository = require("./src/repositories/messageRetryRepository");
const { readRetryRetentionSeconds } = require("./src/baileys/messageRetryStore");

const PORT = Number(process.env.PORT || 4000);
const server = http.createServer(app);
let retryCleanupTimer;
let retryCleanupRunning = false;

async function cleanupExpiredMessageRetries() {
  if (retryCleanupRunning) return;
  retryCleanupRunning = true;
  try {
    // Bound each pass so cleanup cannot monopolize the shared database pool.
    for (let batch = 0; batch < 10; batch += 1) {
      if (await messageRetryRepository.deleteExpired() < 1000) break;
    }
  } catch (err) {
    logger.error({ err }, "Cleaning up expired WhatsApp retry payloads failed");
  } finally {
    retryCleanupRunning = false;
  }
}

initSocketServer(server);

async function startServer() {
  readRetryRetentionSeconds();
  await query("SELECT 1");
  await messageRetryRepository.assertReady();
  await ensureDefaultAdmin();
  await cleanupExpiredMessageRetries();
  retryCleanupTimer = setInterval(cleanupExpiredMessageRetries, 5 * 60 * 1000);
  retryCleanupTimer.unref();
  startWorker();

  server.listen(PORT, () => {
    logger.info({ port: PORT }, "Server started");

    clientManager.restorePersistedClients().catch((err) => {
      logger.error({ err }, "Persisted client restore failed");
    });
  });
}

startServer().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});

function gracefulShutdown() {
  logger.info("Received shutdown signal. Stopping worker and server...");
  stopWorker();
  clearInterval(retryCleanupTimer);
  
  // Close Baileys sockets
  for (const [userId, client] of clientManager.clients.entries()) {
    try {
      client.sock?.end?.(new Error("Server shutting down"));
      client.sock?.ws?.close?.();
    } catch (e) {
      // ignore
    }
  }

  server.close(() => {
    logger.info("HTTP server closed.");
    pool.end().then(() => {
      logger.info("Database pool closed.");
      process.exit(0);
    });
  });

  setTimeout(() => {
    logger.error("Forcefully shutting down...");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
