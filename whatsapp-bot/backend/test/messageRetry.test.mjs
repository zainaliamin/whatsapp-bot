import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { setImmediate as nextTurn } from "node:timers/promises";
import * as baileys from "@whiskeysockets/baileys";

process.env.NODE_ENV = "production";
const require = createRequire(import.meta.url);
const { createMessageRetryStore, readRetryRetentionSeconds } = require("../src/baileys/messageRetryStore");
const { createRetryableSender } = require("../src/baileys/retryableSender");
const { createMessageRetryRepository } = require("../src/repositories/messageRetryRepository");
const { ClientManager } = require("../src/baileys/clientManager");

const pn = "923001234567@s.whatsapp.net";
const lid = "987654321@lid";
const identityKey = Buffer.alloc(32, 7);

function makeLogger() {
  const records = [];
  const logger = { records, child: () => logger };
  for (const level of ["trace", "debug", "info", "warn", "error", "fatal"]) {
    logger[level] = (...args) => records.push({ level, args });
  }
  return logger;
}

// Simulates durable rows shared by fresh store/socket instances, with real
// protobuf serialization and a controllable database clock for expiry checks.
function makeRepository() {
  const rows = new Map();
  let now = 0;
  const scopeKey = (value) => JSON.stringify([
    value.userId, value.clientId, value.sessionId, value.messageId
  ]);
  return {
    rows,
    advance: (seconds) => { now += seconds; },
    async save(value) {
      rows.set(scopeKey(value), {
        ...value,
        payload: Buffer.from(value.payload),
        expiresAt: now + value.retentionSeconds
      });
    },
    async find(value) {
      const stored = rows.get(scopeKey(value));
      return stored && stored.expiresAt > now ? stored : undefined;
    }
  };
}

function makeStore(repository, overrides = {}) {
  return createMessageRetryStore({
    userId: 1,
    clientId: 10,
    identityKey,
    repository,
    proto: baileys.proto,
    jidNormalizedUser: baileys.jidNormalizedUser,
    logger: makeLogger(),
    ...overrides
  });
}

function textMessage() {
  return {
    key: { id: "RETRY-TEST-1", remoteJid: pn, fromMe: true },
    message: { conversation: "Your receipt is ready" }
  };
}

function makeSocket(overrides = {}) {
  return {
    user: { id: "923009999999:3@s.whatsapp.net" },
    processingMutex: { mutex: async (action) => action() },
    upsertMessage: async () => {},
    relayMessage: async () => {},
    ...overrides
  };
}

test("text is retrievable during the very first relay, with the original ID", async () => {
  const repository = makeRepository();
  const store = makeStore(repository);
  const events = [];
  const sock = makeSocket({
    async relayMessage(jid, content, options) {
      assert.equal(jid, pn);
      assert.equal(repository.rows.size, 1);
      const recovered = await store.getMessage({
        id: options.messageId, remoteJid: "923001234567:4@s.whatsapp.net", fromMe: true
      });
      assert.deepEqual(recovered, content);
      events.push(options.messageId);
    },
    async upsertMessage(message, type) {
      assert.equal(type, "append");
      events.push(message.key.id);
    }
  });
  const send = createRetryableSender({ sock, store, baileys, logger: makeLogger() });
  const sent = await send(pn, { text: "Your receipt is ready" }, 41);
  await nextTurn();
  assert.equal(sent.key.fromMe, true);
  assert.equal(sent.message.extendedTextMessage.text, "Your receipt is ready");
  assert.deepEqual(events, [sent.key.id, sent.key.id]);
  assert.equal([...repository.rows.values()][0].messageLogId, 41);
});

test("relay waits for durable commit when the database write is still pending", async () => {
  const repository = makeRepository();
  const save = repository.save.bind(repository);
  let releaseWrite;
  let writeStarted;
  const writing = new Promise((resolve) => { writeStarted = resolve; });
  const committed = new Promise((resolve) => { releaseWrite = resolve; });
  repository.save = async (value) => {
    writeStarted();
    await committed;
    await save(value);
  };
  const store = makeStore(repository);
  let relays = 0;
  const sock = makeSocket({ relayMessage: async () => { relays += 1; } });
  const send = createRetryableSender({ sock, store, baileys, logger: makeLogger() });
  const sending = send(pn, { text: "Commit before relay" }, 41);
  await writing;
  await nextTurn();
  assert.equal(relays, 0);
  assert.equal(repository.rows.size, 0);
  releaseWrite();
  await sending;
  assert.equal(relays, 1);
  assert.equal(repository.rows.size, 1);
  await nextTurn();
});

test("images retain original encrypted media metadata after a fresh store instance", async () => {
  const repository = makeRepository();
  const store = makeStore(repository);
  let uploads = 0;
  const sock = makeSocket({
    async waUploadToServer(filePath, options) {
      uploads += 1;
      assert.ok((await readFile(filePath)).length > 0);
      assert.equal(options.mediaType, "image");
      return { mediaUrl: "https://example.invalid/media", directPath: "/media/test" };
    }
  });
  const send = createRetryableSender({ sock, store, baileys, logger: makeLogger() });
  const sent = await send(pn, {
    image: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a26sAAAAASUVORK5CYII=", "base64"),
    caption: "Invoice",
    jpegThumbnail: Buffer.from([1, 2, 3])
  }, 42);
  const freshStore = makeStore(repository);
  const recovered = await freshStore.getMessage(sent.key);
  assert.deepEqual(recovered, sent.message);
  assert.equal(recovered.imageMessage.caption, "Invoice");
  assert.equal(recovered.imageMessage.mediaKey.length, 32);
  assert.equal(recovered.imageMessage.fileSha256.length, 32);
  assert.equal(recovered.imageMessage.fileEncSha256.length, 32);
  assert.equal(recovered.imageMessage.directPath, "/media/test");
  assert.equal(uploads, 1, "recovery must not re-upload or regenerate the image");
  await nextTurn();
});

test("a failed durable write prevents relay and does not leak driver SQL", async () => {
  const logger = makeLogger();
  const repository = makeRepository();
  repository.save = async () => {
    throw Object.assign(new Error("private SQL payload"), { code: "ER_DISK_FULL", sql: "private SQL payload" });
  };
  const store = makeStore(repository, { logger });
  let relays = 0;
  const sock = makeSocket({ relayMessage: async () => { relays += 1; } });
  const send = createRetryableSender({ sock, store, baileys, logger });
  await assert.rejects(send(pn, { text: "Private content" }, 41), {
    code: "WHATSAPP_RETRY_STORAGE_FAILED"
  });
  assert.equal(relays, 0);
  assert.doesNotMatch(JSON.stringify(logger.records), /private SQL payload|Private content/);
});

test("a transport failure retains recovery data without starting a second send", async () => {
  const repository = makeRepository();
  const store = makeStore(repository);
  let relayId;
  let relays = 0;
  const sock = makeSocket({
    async relayMessage(jid, content, options) {
      relays += 1;
      relayId = options.messageId;
      throw new Error("Connection closed after relay started");
    }
  });
  const send = createRetryableSender({ sock, store, baileys, logger: makeLogger() });
  await assert.rejects(send(pn, { text: "Receipt" }, 41), /Connection closed/);
  assert.equal(relays, 1);
  assert.ok(await makeStore(repository).getMessage({ id: relayId, remoteJid: pn, fromMe: true }));
});

test("tenant, client, linked identity, chat, and direction boundaries are enforced", async () => {
  const repository = makeRepository();
  const message = textMessage();
  await makeStore(repository).saveMessage(message, 41);
  for (const overrides of [{ userId: 2 }, { clientId: 20 }, { identityKey: Buffer.alloc(32, 8) }]) {
    assert.equal(await makeStore(repository, overrides).getMessage(message.key), undefined);
  }
  assert.equal(await makeStore(repository).getMessage({ ...message.key, remoteJid: "923001111111@s.whatsapp.net" }), undefined);
  assert.equal(await makeStore(repository).getMessage({ ...message.key, fromMe: false }), undefined);
  assert.equal(await makeStore(repository).getMessage({ id: message.key.id }), undefined);
  assert.deepEqual(await makeStore(repository).getMessage(message.key), baileys.proto.Message.fromObject(message.message));
});

test("phone-number/LID aliases require a verified matching pair", async () => {
  const repository = makeRepository();
  const message = textMessage();
  await makeStore(repository).saveMessage(message, 41);
  const request = { ...message.key, remoteJid: "987654321:4@lid" };
  const store = makeStore(repository, {
    resolvePhoneNumber: async (jid) => {
      assert.equal(jid, pn);
      return [{ jid: pn, exists: true, lid }];
    }
  });
  assert.ok(await store.getMessage(request));
  for (const matches of [[], [{ jid: pn, exists: true, lid: "999@lid" }], [{ jid: pn, exists: false, lid }]]) {
    const rejected = makeStore(repository, { resolvePhoneNumber: async () => matches });
    assert.equal(await rejected.getMessage(request), undefined);
  }
});

test("expired, missing, empty and corrupt messages return undefined", async () => {
  const repository = makeRepository();
  const logger = makeLogger();
  const store = makeStore(repository, { retentionSeconds: 30, logger });
  const message = textMessage();
  assert.equal(await store.getMessage(message.key), undefined);
  await store.saveMessage(message, 41);
  repository.advance(30);
  assert.equal(await store.getMessage(message.key), undefined);
  repository.advance(-30);
  const row = [...repository.rows.values()][0];
  row.payload = Buffer.from([0x0a, 0xff]);
  assert.equal(await store.getMessage(message.key), undefined);
  row.payload = Buffer.alloc(0);
  assert.equal(await store.getMessage(message.key), undefined);
  assert.ok(logger.records.some((record) => record.level === "error"));
});

test("database and alias-resolution failures do not throw out of the retry callback", async () => {
  const repository = makeRepository();
  const message = textMessage();
  await makeStore(repository).saveMessage(message, 41);
  const store = makeStore(repository, { resolvePhoneNumber: async () => { throw new Error("Offline"); } });
  assert.equal(await store.getMessage({ ...message.key, remoteJid: lid }), undefined);
  repository.find = async () => { throw new Error("DB offline"); };
  assert.equal(await store.getMessage(message.key), undefined);
});

test("socket construction wires persistent retry lookup across reconnects", async () => {
  const repository = makeRepository();
  const configurations = [];
  const sockets = [];
  const module = {
    ...baileys,
    useMultiFileAuthState: async () => ({
      state: { creds: { signedIdentityKey: { public: identityKey } } },
      saveCreds: async () => {}
    }),
    fetchLatestBaileysVersion: async () => ({ version: [2, 3000, 1] }),
    makeWASocket: (config) => {
      configurations.push(config);
      const sock = makeSocket({
        ev: { on: () => {} },
        onWhatsApp: async () => [{ jid: pn, exists: true, lid }],
        async relayMessage(jid, content, options) {
          assert.deepEqual(await config.getMessage({ id: options.messageId, remoteJid: jid, fromMe: true }), content);
        }
      });
      sockets.push(sock);
      return sock;
    }
  };
  const manager = new ClientManager({ loadBaileys: async () => module, retryRepository: repository });
  manager.createBaileysLogger = () => makeLogger();
  await manager._initClient(1, 10, process.cwd());
  const sent = await manager.getClientByUserId(1).sendMessage(pn, { text: "Reconnect test" }, 41);
  await manager._initClient(1, 10, process.cwd());
  assert.notEqual(sockets[0], sockets[1]);
  assert.deepEqual(await configurations[1].getMessage(sent.key), sent.message);
  assert.equal(configurations[1].markOnlineOnConnect, false);
  await nextTurn();
});

test("repository binds the full identity scope and expiry in SQL", async () => {
  const calls = [];
  const repository = createMessageRetryRepository(async (sql, params) => {
    calls.push({ sql, params });
    return sql.startsWith("SELECT") ? [] : { affectedRows: 3 };
  });
  const value = {
    userId: 1, clientId: 10, sessionId: "session", messageId: "id", remoteJid: pn,
    messageLogId: 41, payload: Buffer.from([1]), retentionSeconds: 30
  };
  await repository.save(value);
  assert.deepEqual(calls[0].params, [1, 10, "session", "id", pn, 41, value.payload, 30]);
  assert.match(calls[0].sql, /DATE_ADD\(NOW\(\), INTERVAL \? SECOND\)/);
  assert.equal(await repository.find(value), undefined);
  assert.deepEqual(calls[1].params, [1, 10, "session", "id"]);
  assert.match(calls[1].sql, /expires_at > NOW\(\)/);
  assert.equal(await repository.deleteExpired(), 3);
  assert.match(calls[2].sql, /expires_at <= NOW\(\) LIMIT 1000/);
});

test("missing migration is reported before the backend starts", async () => {
  const repository = createMessageRetryRepository(async () => {
    throw Object.assign(new Error("Table missing"), { code: "ER_NO_SUCH_TABLE" });
  });
  await assert.rejects(repository.assertReady(), /20261107_add_whatsapp_message_retries\.sql/);
});

test("startup readiness validates all required columns and reports an incomplete table", async () => {
  const repository = createMessageRetryRepository(async (sql) => {
    for (const column of [
      "user_id", "client_id", "session_id", "whatsapp_message_id", "remote_jid",
      "message_log_id", "message_payload", "created_at", "expires_at"
    ]) {
      assert.ok(sql.includes(column), `Readiness check must validate ${column}`);
    }
    throw Object.assign(new Error("Unknown column"), { code: "ER_BAD_FIELD_ERROR" });
  });
  await assert.rejects(repository.assertReady(), /incomplete.*schema/i);
});

test("retention configuration accepts whole seconds and rejects invalid values", () => {
  assert.equal(readRetryRetentionSeconds(""), 604800);
  assert.equal(readRetryRetentionSeconds("  "), 604800);
  assert.equal(readRetryRetentionSeconds("604800"), 604800);
  assert.equal(readRetryRetentionSeconds("60"), 60);
  for (const value of ["0", "-1", "0.5", "1.9", "NaN", "Infinity", "foo", "9007199254740992"]) {
    assert.throws(() => readRetryRetentionSeconds(value), /WA_RETRY_RETENTION_SECONDS/);
  }
});
