const http = require("http");
const { app } = require("./src/app");
const { initSocketServer } = require("./src/sockets/socketServer");
const { logger } = require("./src/config/logger");
const { query } = require("./src/config/database");
const { ensureDefaultAdmin } = require("./src/services/bootstrapService");
const { clientManager } = require("./src/baileys/clientManager");
const { startWorker, stopWorker } = require("./src/services/bulkWorker");
const { pool } = require("./src/config/database");

const PORT = Number(process.env.PORT || 4000);
const server = http.createServer(app);

initSocketServer(server);

async function startServer() {
  await query("SELECT 1");
  await ensureDefaultAdmin();
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
