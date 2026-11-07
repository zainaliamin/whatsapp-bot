const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const { setImmediate: nextTurn } = require("node:timers/promises");

const source = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");

function startWith({ schemaError, retentionError, cleanupBatches = [0] } = {}) {
  const events = [];
  const timers = [];
  const noop = () => {};
  const dependencies = {
    http: { createServer: () => ({ listen: (_port, callback) => { events.push("listen"); callback(); } }) },
    "./src/app": { app: {} },
    "./src/sockets/socketServer": { initSocketServer: noop },
    "./src/config/logger": { logger: { info: noop, error: noop } },
    "./src/config/database": { query: async () => { events.push("db"); }, pool: {} },
    "./src/services/bootstrapService": { ensureDefaultAdmin: async () => { events.push("admin"); } },
    "./src/baileys/clientManager": {
      clientManager: { restorePersistedClients: async () => { events.push("restore"); }, clients: new Map() }
    },
    "./src/services/bulkWorker": { startWorker: () => { events.push("worker"); }, stopWorker: noop },
    "./src/repositories/messageRetryRepository": {
      assertReady: async () => { events.push("schema"); if (schemaError) throw schemaError; },
      deleteExpired: async () => { events.push("cleanup"); return cleanupBatches.shift() || 0; }
    },
    "./src/baileys/messageRetryStore": {
      readRetryRetentionSeconds: () => { events.push("retention"); if (retentionError) throw retentionError; }
    }
  };
  const context = {
    require: (id) => {
      assert.ok(id in dependencies, `Unexpected startup dependency: ${id}`);
      return dependencies[id];
    },
    process: { env: {}, on: noop, exit: (code) => events.push(`exit:${code}`) },
    setInterval: (callback, delay) => {
      timers.push({ callback, delay });
      return { unref: noop };
    },
    clearInterval: noop,
    setTimeout: noop
  };
  vm.runInNewContext(source, context, { filename: "server.js" });
  return { events, timers, context };
}

test("startup checks configuration and schema before workers or HTTP begin", async () => {
  const { events, timers } = startWith({ cleanupBatches: [1000, 1000, 2] });
  await nextTurn();
  assert.deepEqual(events, ["retention", "db", "schema", "admin", "cleanup", "cleanup", "cleanup", "worker", "listen", "restore"]);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 5 * 60 * 1000);
});

test("missing schema prevents both message workers and HTTP startup", async () => {
  const { events, timers } = startWith({ schemaError: new Error("Missing retry table") });
  await nextTurn();
  assert.deepEqual(events, ["retention", "db", "schema", "exit:1"]);
  assert.equal(timers.length, 0);
});

test("invalid retention prevents startup before database or session activity", async () => {
  const { events } = startWith({ retentionError: new Error("Invalid retry retention") });
  await nextTurn();
  assert.deepEqual(events, ["retention", "exit:1"]);
});

test("expiry cleanup bounds one pass to ten batches", async () => {
  const { events } = startWith({ cleanupBatches: Array(15).fill(1000) });
  await nextTurn();
  assert.equal(events.filter((event) => event === "cleanup").length, 10);
  assert.ok(events.includes("listen"));
});
