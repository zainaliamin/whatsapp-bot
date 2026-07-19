const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");

const clientRepository = require("../repositories/clientRepository");
const tokenService = require("../services/tokenService");
const { emitToUser } = require("../sockets/socketServer");
const { logger } = require("../config/logger");
const { CLIENT_STATUS } = require("../utils/constants");

let baileysModuleCache = null;

function positiveNumberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const SESSION_CRYPTO_ERROR_WINDOW_MS = positiveNumberFromEnv("WA_SESSION_ERROR_WINDOW_MS", 60_000);
const SESSION_CRYPTO_ERROR_LOG_INTERVAL_MS = positiveNumberFromEnv("WA_SESSION_ERROR_LOG_INTERVAL_MS", 60_000);
const MAX_AUTO_RECONNECT_FAILURES = positiveNumberFromEnv("WA_MAX_AUTO_RECONNECT_FAILURES", 3);

function fireAndForget(task, onError) {
  Promise.resolve(task()).catch(onError);
}

function normalizeLogArg(arg) {
  if (!arg) {
    return "";
  }

  if (typeof arg === "string") {
    return arg;
  }

  if (arg instanceof Error) {
    return `${arg.name} ${arg.message} ${arg.stack || ""}`;
  }

  if (typeof arg === "object") {
    const err = arg.err || arg.error;
    const errText = err ? normalizeLogArg(err) : "";
    return `${arg.msg || ""} ${arg.message || ""} ${errText}`;
  }

  return String(arg);
}

function isSessionCryptoError(args) {
  const text = args.map(normalizeLogArg).join(" ").toLowerCase();
  return (
    text.includes("bad mac") ||
    text.includes("no matching sessions found") ||
    text.includes("failed to decrypt message")
  );
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
    this.sessionCryptoErrors = new Map();
    this.sessionCryptoLastLoggedAt = new Map();
    this.autoReconnectFailures = new Map();
    this.autoReconnectTimers = new Map();
  }

  getSessionPath(userId) {
    return path.join(process.cwd(), "sessions", `user-${userId}`);
  }

  hasSessionCreds(userId, sessionPath) {
    const directory = sessionPath || this.getSessionPath(userId);
    return fs.existsSync(path.join(directory, "creds.json"));
  }

  async initClient(userId, clientId, sessionPath, options = {}) {
    const { allowPairing = true, force = false, resetAutoReconnectFailures = false } = options;
    const userKey = String(userId);
    const directory = sessionPath || this.getSessionPath(userId);

    if (resetAutoReconnectFailures) {
      this.clearAutoReconnectState(userKey);
    }

    if (allowPairing) {
      this.sessionCryptoErrors.delete(userKey);
      this.sessionCryptoLastLoggedAt.delete(userKey);
    }

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

  async _initClient(userId, clientId, directory, options = {}) {
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
      logger: this.createBaileysLogger(userId, clientId),
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
            emitToUser(userId, "client:connected", {
              status: CLIENT_STATUS.CONNECTED,
              message: "WhatsApp connecting"
            });
          }

          if (connection === "open") {
            await clientRepository.updateStatusByUserId(userId, CLIENT_STATUS.READY);
            const apiToken = await tokenService.getOrCreateUserToken(userId);
            this.clearAutoReconnectState(userKey);

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
            const isCurrentSocket = current?.sock === sock;

            if (!isCurrentSocket) {
              return;
            }

            this.clients.delete(userKey);

            const failureCount = this.recordAutoReconnectFailure(userKey);
            const willRetry = failureCount < MAX_AUTO_RECONNECT_FAILURES;
            const message = willRetry
              ? (isLoggedOut ? "Logged out from WhatsApp. Reconnecting for new QR..." : "Connection closed")
              : "WhatsApp reconnect stopped after repeated failures. Please reconnect manually.";

            // Keep DB status enum-compatible; runtime event can still signal LOGOUT.
            await clientRepository.updateStatusByUserId(userId, CLIENT_STATUS.DISCONNECTED);
            emitToUser(userId, "client:disconnected", {
              status: isLoggedOut ? CLIENT_STATUS.LOGOUT : CLIENT_STATUS.DISCONNECTED,
              message,
              failureCount,
              maxFailures: MAX_AUTO_RECONNECT_FAILURES,
              willRetry
            });

            logger.warn(
              { userId, reasonCode, failureCount, maxFailures: MAX_AUTO_RECONNECT_FAILURES, willRetry },
              "WhatsApp client disconnected"
            );

            if (!willRetry) {
              emitToUser(userId, "client:error", {
                message,
                failureCount,
                maxFailures: MAX_AUTO_RECONNECT_FAILURES
              });
              return;
            }

            let cleanupOk = true;
            if (isLoggedOut) {
              try {
                this.resetSessionFiles(userId, directory);
              } catch (err) {
                cleanupOk = false;
                logger.error({ err, userId }, "Failed to reset session after logout");
              }
            }

            if (!cleanupOk) {
              logger.error({ userId }, "Aborting reconnection because session cleanup failed");
              return;
            }

            this.clearAutoReconnectTimer(userKey);
            const reconnectTimer = setTimeout(() => {
              this.autoReconnectTimers.delete(userKey);
              this.initClient(userId, clientId, directory, {
                allowPairing: isLoggedOut,
                force: true
              }).catch((err) => {
                logger.error({ err, userId }, "Client reconnect failed");
                emitToUser(userId, "client:error", { message: "Reconnect failed" });
              });
            }, isLoggedOut ? 1200 : 3000);
            this.autoReconnectTimers.set(userKey, reconnectTimer);
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

  recordAutoReconnectFailure(userKey) {
    const nextCount = (this.autoReconnectFailures.get(userKey) || 0) + 1;
    this.autoReconnectFailures.set(userKey, nextCount);
    return nextCount;
  }

  clearAutoReconnectTimer(userKey) {
    const timer = this.autoReconnectTimers.get(userKey);
    if (timer) {
      clearTimeout(timer);
      this.autoReconnectTimers.delete(userKey);
    }
  }

  clearAutoReconnectState(userKey) {
    this.clearAutoReconnectTimer(userKey);
    this.autoReconnectFailures.delete(userKey);
  }

  createBaileysLogger(userId, clientId, baseLogger = logger.child({ class: "baileys", userId, clientId })) {
    const wrap = (targetLogger) => ({
      trace: (...args) => targetLogger.trace(...args),
      debug: (...args) => targetLogger.debug(...args),
      info: (...args) => targetLogger.info(...args),
      warn: (...args) => targetLogger.warn(...args),
      fatal: (...args) => targetLogger.fatal(...args),
      error: (...args) => {
        if (isSessionCryptoError(args)) {
          this.recordSessionCryptoError(userId, clientId);
          // Bad MAC/decrypt errors belong to a remote contact's Signal session.
          // Baileys can recover that session itself; forwarding every stack trace
          // floods PM2 logs and previously caused the whole bot session to reset.
          return;
        }
        targetLogger.error(...args);
      },
      child: (bindings) => wrap(targetLogger.child(bindings))
    });

    return wrap(baseLogger);
  }

  recordSessionCryptoError(userId, clientId) {
    const userKey = String(userId);
    const now = Date.now();
    const recent = (this.sessionCryptoErrors.get(userKey) || [])
      .filter((timestamp) => now - timestamp <= SESSION_CRYPTO_ERROR_WINDOW_MS);
    recent.push(now);
    this.sessionCryptoErrors.set(userKey, recent);

    const lastLoggedAt = this.sessionCryptoLastLoggedAt.get(userKey) || 0;
    if (now - lastLoggedAt < SESSION_CRYPTO_ERROR_LOG_INTERVAL_MS) {
      return;
    }

    this.sessionCryptoLastLoggedAt.set(userKey, now);
    logger.warn(
      {
        userId,
        clientId,
        count: recent.length,
        windowMs: SESSION_CRYPTO_ERROR_WINDOW_MS
      },
      "WhatsApp contact decrypt errors detected; allowing Baileys to recover the remote session"
    );
  }

  resetSessionFiles(userId, sessionPath) {
    const userKey = String(userId);
    const existing = this.clients.get(userKey);
    this.clients.delete(userKey);
    this.clearAutoReconnectState(userKey);

    if (existing?.sock) {
      try {
        existing.sock.end?.(new Error("Resetting WhatsApp session"));
      } catch (err) {
        logger.warn({ err, userId }, "Failed to end WhatsApp socket during session reset");
      }

      try {
        existing.sock.ws?.close?.();
      } catch (err) {
        logger.warn({ err, userId }, "Failed to close WhatsApp websocket during session reset");
      }
    }

    const directory = sessionPath || this.getSessionPath(userId);
    if (fs.existsSync(directory)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
    fs.mkdirSync(directory, { recursive: true });
    this.sessionCryptoErrors.delete(userKey);
    this.sessionCryptoLastLoggedAt.delete(userKey);
  }

  async logoutClient(userId) {
    const userKey = String(userId);
    const existing = this.clients.get(userKey);
    this.clients.delete(userKey);
    this.clearAutoReconnectState(userKey);

    if (!existing) {
      return;
    }

    await existing.sock.logout();
  }

  async removeClient(userId) {
    const userKey = String(userId);
    const existing = this.clients.get(userKey);
    this.clients.delete(userKey);
    this.clearAutoReconnectState(userKey);

    if (existing) {
      try {
        await existing.sock.logout();
      } catch (_err) {
        // Ignore logout errors while deleting client.
      }
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
