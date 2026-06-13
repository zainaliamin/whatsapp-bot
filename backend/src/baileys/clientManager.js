const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");

const clientRepository = require("../repositories/clientRepository");
const tokenService = require("../services/tokenService");
const { emitToUser } = require("../sockets/socketServer");
const { logger } = require("../config/logger");
const { CLIENT_STATUS } = require("../utils/constants");

let baileysModuleCache = null;

function fireAndForget(task, onError) {
  Promise.resolve(task()).catch(onError);
}

async function getBaileysModule() {
  if (baileysModuleCache) {
    return baileysModuleCache;
  }

  const module = await import("@whiskeysockets/baileys");
  baileysModuleCache = {
    makeWASocket: module.default,
    useMultiFileAuthState: module.useMultiFileAuthState,
    DisconnectReason: module.DisconnectReason,
    fetchLatestBaileysVersion: module.fetchLatestBaileysVersion
  };

  return baileysModuleCache;
}

class ClientManager {
  constructor() {
    this.clients = new Map();
    this.pendingInitializations = new Map();
  }

  getSessionPath(userId) {
    return path.join(process.cwd(), "sessions", `user-${userId}`);
  }

  hasSessionCreds(userId, sessionPath) {
    const directory = sessionPath || this.getSessionPath(userId);
    return fs.existsSync(path.join(directory, "creds.json"));
  }

  async initClient(userId, clientId, sessionPath, options = {}) {
    const { allowPairing = true, force = false } = options;
    const userKey = String(userId);
    const directory = sessionPath || this.getSessionPath(userId);

    if (!allowPairing && !fs.existsSync(path.join(directory, "creds.json"))) {
      throw new Error("Saved session credentials not found");
    }

    if (!force) {
      const existing = this.clients.get(userKey);
      if (existing?.sock) {
        return { userId, clientId, sessionPath: existing.sessionPath };
      }

      const pending = this.pendingInitializations.get(userKey);
      if (pending) {
        return pending;
      }
    }

    const initPromise = this._initClient(userId, clientId, directory, { allowPairing, force });
    this.pendingInitializations.set(userKey, initPromise);

    try {
      return await initPromise;
    } finally {
      this.pendingInitializations.delete(userKey);
    }
  }

  async _initClient(userId, clientId, directory) {
    const {
      makeWASocket,
      useMultiFileAuthState,
      DisconnectReason,
      fetchLatestBaileysVersion
    } = await getBaileysModule();

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(directory);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      markOnlineOnConnect: false
    });

    const userKey = String(userId);
    this.clients.set(userKey, { sock, clientId, sessionPath: directory });

    sock.ev.on("creds.update", () => {
      fireAndForget(
        () => saveCreds(),
        (err) => logger.error({ err, userId, clientId }, "Saving Baileys credentials failed")
      );
    });

    sock.ev.on("connection.update", (update) => {
      fireAndForget(
        async () => {
          const { connection, lastDisconnect, qr } = update;

          if (qr) {
            const qrData = await QRCode.toDataURL(qr);
            await clientRepository.updateStatusByUserId(userId, CLIENT_STATUS.QR_READY);
            emitToUser(userId, "client:qr", {
              status: CLIENT_STATUS.QR_READY,
              qr: qrData
            });
          }

          if (connection === "connecting") {
            await clientRepository.updateStatusByUserId(userId, CLIENT_STATUS.CONNECTED);
            emitToUser(userId, "client:connected", {
              status: CLIENT_STATUS.CONNECTED,
              message: "WhatsApp connecting"
            });
          }

          if (connection === "open") {
            await clientRepository.updateStatusByUserId(userId, CLIENT_STATUS.READY);
            const apiToken = await tokenService.getOrCreateUserToken(userId);

            logger.info({ userId, clientId }, "WhatsApp client ready");
            emitToUser(userId, "client:ready", {
              status: CLIENT_STATUS.READY,
              message: "WhatsApp client is ready",
              apiToken
            });
          }

          if (connection === "close") {
            const reasonCode = lastDisconnect?.error?.output?.statusCode;
            const isLoggedOut = reasonCode === DisconnectReason.loggedOut;
            const current = this.clients.get(userKey);

            if (current?.sock === sock) {
              this.clients.delete(userKey);
            }

            // Keep DB status enum-compatible; runtime event can still signal LOGOUT.
            await clientRepository.updateStatusByUserId(userId, CLIENT_STATUS.DISCONNECTED);
            emitToUser(userId, "client:disconnected", {
              status: isLoggedOut ? CLIENT_STATUS.LOGOUT : CLIENT_STATUS.DISCONNECTED,
              message: isLoggedOut ? "Logged out from WhatsApp. Reconnecting for new QR..." : "Connection closed"
            });

            logger.warn({ userId, reasonCode }, "WhatsApp client disconnected");

            if (isLoggedOut) {
              try {
                // Logged-out creds are invalid; reset session files so next init produces a fresh QR.
                if (fs.existsSync(directory)) {
                  fs.rmSync(directory, { recursive: true, force: true });
                }
                fs.mkdirSync(directory, { recursive: true });
              } catch (err) {
                logger.error({ err, userId }, "Failed to reset session after logout");
              }
            }

            setTimeout(() => {
              this.initClient(userId, clientId, directory, {
                allowPairing: isLoggedOut,
                force: true
              }).catch((err) => {
                logger.error({ err, userId }, "Client reconnect failed");
                emitToUser(userId, "client:error", { message: "Reconnect failed" });
              });
            }, isLoggedOut ? 1200 : 3000);
          }
        },
        (err) => {
          logger.error({ err, userId, clientId, update }, "WhatsApp connection update handling failed");
          emitToUser(userId, "client:error", { message: "Client event handling failed" });
        }
      );
    });

    return { userId, clientId, sessionPath: directory };
  }

  getClientByUserId(userId) {
    return this.clients.get(String(userId));
  }

  async logoutClient(userId) {
    const existing = this.clients.get(String(userId));
    if (!existing) {
      return;
    }

    await existing.sock.logout();
    this.clients.delete(String(userId));
  }

  async removeClient(userId) {
    const existing = this.clients.get(String(userId));
    if (existing) {
      try {
        await existing.sock.logout();
      } catch (_err) {
        // Ignore logout errors while deleting client.
      }
      this.clients.delete(String(userId));
    }

    const dir = this.getSessionPath(userId);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  async restorePersistedClients() {
    const recoverableClients = await clientRepository.listRecoverableClients();

    await Promise.all(
      recoverableClients.map(async (client) => {
        if (!client.sessionPath || !fs.existsSync(path.join(client.sessionPath, "creds.json"))) {
          await clientRepository.updateStatusByUserId(client.userId, CLIENT_STATUS.DISCONNECTED);
          logger.warn({ userId: client.userId, clientId: client.id }, "Skipping client restore: saved session missing");
          return;
        }

        try {
          await this.initClient(client.userId, client.id, client.sessionPath, { allowPairing: false });
        } catch (err) {
          logger.error({ err, userId: client.userId, clientId: client.id }, "Client restore failed on startup");
        }
      })
    );
  }
}

const clientManager = new ClientManager();

module.exports = { clientManager };
