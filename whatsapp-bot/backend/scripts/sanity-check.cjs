const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "production";
const root = path.resolve(__dirname, "..");

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : (file.endsWith(".js") ? [file] : []);
  });
}

async function main() {
  assert.ok(Number(process.versions.node.split(".")[0]) >= 20, "Node.js 20+ is required");
  const files = sourceFiles(path.join(root, "src"));
  for (const file of [...files, path.join(root, "server.js"), __filename]) {
    new vm.Script(fs.readFileSync(file, "utf8"), { filename: file });
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
  JSON.parse(fs.readFileSync(path.join(root, "nodemon.json"), "utf8"));
  assert.deepEqual(manifest.dependencies, lock.packages[""].dependencies);
  assert.deepEqual(manifest.engines, lock.packages[""].engines);

  const schema = fs.readFileSync(path.join(root, "database/schema.sql"), "utf8").replaceAll("\r\n", "\n");
  const migration = fs.readFileSync(path.join(root, "database/migrations/20261107_add_whatsapp_message_retries.sql"), "utf8").replaceAll("\r\n", "\n");
  const table = /CREATE TABLE IF NOT EXISTS whatsapp_message_retries \([\s\S]*?\n\);/;
  assert.ok(schema.match(table), "Fresh-install schema is missing the retry table");
  assert.equal(schema.match(table)[0], migration.match(table)?.[0], "Retry migration and fresh schema must match");

  for (const file of files) require(file);
  const baileys = await import("@whiskeysockets/baileys");
  for (const name of ["default", "generateWAMessage", "generateMessageIDV2", "getUrlInfo", "jidNormalizedUser"]) {
    assert.equal(typeof baileys[name], "function", `Missing Baileys API: ${name}`);
  }
  assert.equal(typeof baileys.proto.Message.encode, "function");
  assert.equal(typeof baileys.proto.Message.decode, "function");
  const installed = JSON.parse(fs.readFileSync(
    path.join(path.dirname(require.resolve("@whiskeysockets/baileys")), "../package.json"), "utf8"
  ));
  assert.equal(installed.version, manifest.dependencies["@whiskeysockets/baileys"]);

  console.log(`Sanity passed: ${files.length} backend modules loaded; JavaScript/JSON syntax, pinned Baileys APIs, lockfile, and schema consistency checked.`);
  console.log("No database connection, WhatsApp socket, or background worker was started.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
}).finally(async () => {
  const database = require.cache[require.resolve("../src/config/database")];
  if (database) await database.exports.pool.end();
});
