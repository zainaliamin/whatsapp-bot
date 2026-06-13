const http = require("http");
const { app } = require("./src/app");
const { initSocketServer } = require("./src/sockets/socketServer");
const { logger } = require("./src/config/logger");
const { query } = require("./src/config/database");
const { ensureDefaultAdmin } = require("./src/services/bootstrapService");
const { clientManager } = require("./src/baileys/clientManager");

const PORT = Number(process.env.PORT || 4000);
const server = http.createServer(app);

initSocketServer(server);

async function startServer() {
  await query("SELECT 1");
  await ensureDefaultAdmin();

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
