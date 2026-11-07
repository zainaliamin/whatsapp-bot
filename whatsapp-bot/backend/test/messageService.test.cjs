const test = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "production";
const { clientManager } = require("../src/baileys/clientManager");
const clientRepository = require("../src/repositories/clientRepository");
const messageRepository = require("../src/repositories/messageRepository");
const numberCheckRepository = require("../src/repositories/numberCheckRepository");
const messageService = require("../src/services/messageService");
const { logger } = require("../src/config/logger");

function setup(t, sendMessage) {
  const statuses = [];
  const presence = [];
  const sock = {
    sendPresenceUpdate: async (type) => { presence.push(type); },
    sendMessage: () => { throw new Error("Unpersisted send path was used"); }
  };
  t.mock.method(global, "setTimeout", (callback) => { queueMicrotask(callback); });
  t.mock.method(logger, "error", () => {});
  t.mock.method(clientRepository, "findByUserId", async () => ({ id: 10, status: "READY" }));
  t.mock.method(clientManager, "getClientByUserId", () => ({ sock, sendMessage }));
  t.mock.method(numberCheckRepository, "findValidByUserAndPhone", async () => ({
    isOnWhatsapp: true, whatsappJid: "923001234567@s.whatsapp.net"
  }));
  t.mock.method(messageRepository, "createMessage", async () => ({ id: 41 }));
  t.mock.method(messageRepository, "updateMessageStatus", async (id, status) => { statuses.push({ id, status }); });
  return { statuses, presence };
}

test("text and image API paths both use the durable sender with their log ID", async (t) => {
  const calls = [];
  const { statuses, presence } = setup(t, async (...args) => {
    calls.push(args);
    return { key: { id: "original-whatsapp-id" } };
  });
  const common = { userId: 1, recipientNumber: "923001234567", sourceApplication: "test" };
  const text = await messageService.sendTextMessage({ ...common, messageText: "Receipt" });
  const image = await messageService.sendImageMessage({ ...common, imageUrl: "https://example.invalid/invoice.png", caption: "Invoice" });
  assert.deepEqual(calls, [
    ["923001234567@s.whatsapp.net", { text: "Receipt" }, 41],
    ["923001234567@s.whatsapp.net", { image: { url: "https://example.invalid/invoice.png" }, caption: "Invoice" }, 41]
  ]);
  assert.deepEqual(text, { messageId: 41, status: "SENT", whatsappMessageId: "original-whatsapp-id" });
  assert.deepEqual(image, text);
  assert.deepEqual(statuses, [{ id: 41, status: "SENT" }, { id: 41, status: "SENT" }]);
  assert.deepEqual(presence, ["available", "composing", "paused", "available", "composing", "paused"]);
});

test("retry storage failure has a specific API error and keeps the message unsent", async (t) => {
  const { statuses, presence } = setup(t, async () => {
    throw Object.assign(new Error("Retry storage unavailable"), { code: "WHATSAPP_RETRY_STORAGE_FAILED" });
  });
  await assert.rejects(messageService.sendTextMessage({
    userId: 1, recipientNumber: "923001234567", messageText: "Receipt", sourceApplication: "test"
  }), (err) => err.statusCode === 503 && err.details.code === "WHATSAPP_RETRY_STORAGE_FAILED");
  assert.deepEqual(statuses, [{ id: 41, status: "FAILED" }]);
  assert.equal(presence.at(-1), "paused");
});

test("a failed status write does not mask the storage failure for text or image sends", async (t) => {
  setup(t, async () => {
    throw Object.assign(new Error("Retry storage unavailable"), { code: "WHATSAPP_RETRY_STORAGE_FAILED" });
  });
  t.mock.method(messageRepository, "updateMessageStatus", async () => {
    throw new Error("Database connection lost during status update");
  });
  const common = { userId: 1, recipientNumber: "923001234567", sourceApplication: "test" };
  const expected = (err) => err.statusCode === 503 && err.details.code === "WHATSAPP_RETRY_STORAGE_FAILED";
  await assert.rejects(messageService.sendTextMessage({ ...common, messageText: "Receipt" }), expected);
  await assert.rejects(messageService.sendImageMessage({ ...common, imageUrl: "https://example.invalid/invoice.png" }), expected);
});
