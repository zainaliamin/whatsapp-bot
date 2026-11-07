const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");

process.env.NODE_ENV = "production";
const { app } = require("../src/app");
const { logger } = require("../src/config/logger");

test("HTTP sanity: health, missing routes, and message authentication", async (t) => {
  t.mock.method(logger, "info", () => {});
  t.mock.method(logger, "warn", () => {});
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve, reject) => {
    server.close((err) => err ? reject(err) : resolve());
    server.closeIdleConnections();
  }));
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;

  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).success, true);
  assert.ok(health.headers.get("x-content-type-options"));

  const missing = await fetch(`${base}/missing-sanity-route`);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).message, "Route not found");

  for (const route of ["send-text", "send-image"]) {
    const response = await fetch(`${base}/api/messages/${route}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}"
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).data.code, "API_TOKEN_REQUIRED");
  }
});
