import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eraseline-test-"));
process.env.PORT = "3999";
process.env.AUTH_SECRET = "test-only-secret";
process.env.REVIEW_DEMO_EMAIL = "demo@eraseline.com";
process.env.REVIEW_DEMO_PASSWORD = "ReviewDemo2026";

await import("../server.js");
await new Promise(resolve => setTimeout(resolve, 200));

const BASE = "http://127.0.0.1:3999";
const request = (method, route, body, token) => fetch(BASE + route, {
  method,
  headers: {
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  },
  ...(body ? { body: JSON.stringify(body) } : {})
});
const post = (route, body, token) => request("POST", route, body, token);
const json = response => response.json();

const health = await fetch(`${BASE}/health`).then(json);
assert.equal(health.ok, true);
assert.equal(health.storage, "file");

const review = await post("/auth/login", {
  email: "demo@eraseline.com",
  password: "ReviewDemo2026"
}).then(json);
assert.equal(review.user.pro, true, "review account is always Pro");

const userA = await post("/auth/register", {
  email: "a@example.com",
  password: "password123"
}).then(json);
const userB = await post("/auth/register", {
  email: "b@example.com",
  password: "password123"
}).then(json);

await post("/scan", { first: "John", last: "Doe", city: "Austin", state: "TX" }, userA.token);
await post("/iap/verify", {
  transactionId: "test-transaction",
  productId: "eraseline.pro.monthly"
}, userA.token);
const optoutsA = await post("/optout/all", {}, userA.token).then(json);
assert.ok(optoutsA.length > 0);

const optoutsVisibleToB = await fetch(`${BASE}/optout`, {
  headers: { Authorization: `Bearer ${userB.token}` }
}).then(json);
assert.deepEqual(optoutsVisibleToB, [], "users cannot read another user's opt-outs");

const deleteResponse = await request("DELETE", "/auth/me", null, userA.token);
assert.equal(deleteResponse.status, 200);

const persisted = JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR, "store.json"), "utf8"));
assert.equal(persisted.users.some(user => user.id === userA.user.id), false);
assert.equal(persisted.scans.some(scan => scan.userId === userA.user.id), false);
assert.equal(persisted.optouts.some(optout => optout.userId === userA.user.id), false);
assert.equal(persisted.monitors.some(monitor => monitor.userId === userA.user.id), false);

console.log("✅ persistence, review account, isolation, and deletion checks passed");
process.exit(0);
