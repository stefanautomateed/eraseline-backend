import express from "express";
import crypto from "node:crypto";
import { BROKERS } from "./brokers.js";
import { runScan, computeScore } from "./scanner.js";
import { createOptOut } from "./optout.js";
import { store, load } from "./store.js";
import { hashPassword, verifyPassword, issueToken, requireAuth, requirePro } from "./auth.js";

load();
const app = express();
app.use(express.json());

const pro = requirePro(id => store.userById(id));

app.get("/health", (_req, res) => res.json({ ok: true, service: "eraseline-api", version: "0.2.0" }));

// ---------- AUTH ----------
// { email, password } → { token, user }
app.post("/auth/register", (req, res) => {
  const { email, password } = req.body || {};
  if (!email?.includes("@") || (password || "").length < 8) {
    return res.status(400).json({ error: "Validan email i lozinka od min 8 karaktera su obavezni." });
  }
  if (store.userByEmail(email)) return res.status(409).json({ error: "Nalog već postoji — uloguj se." });
  const user = {
    id: `u_${crypto.randomUUID()}`,
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    pro: false,
    createdAt: new Date().toISOString()
  };
  store.addUser(user);
  res.json({ token: issueToken(user.id), user: publicUser(user) });
});

app.post("/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  const user = email && store.userByEmail(email);
  if (!user || !verifyPassword(password || "", user.passwordHash)) {
    return res.status(401).json({ error: "Pogrešan email ili lozinka." });
  }
  res.json({ token: issueToken(user.id), user: publicUser(user) });
});

// Sign in with Apple: klijent šalje Apple identity token; MVP prihvata i pravi/loguje nalog.
// Produkcija: verifikovati JWT protiv https://appleid.apple.com/auth/keys
app.post("/auth/apple", (req, res) => {
  const { appleUserId, email } = req.body || {};
  if (!appleUserId) return res.status(400).json({ error: "appleUserId je obavezan" });
  const synthEmail = (email || `${appleUserId}@privaterelay.appleid.com`).toLowerCase();
  let user = store.userByEmail(synthEmail);
  if (!user) {
    user = { id: `u_${crypto.randomUUID()}`, email: synthEmail, appleUserId, pro: false, createdAt: new Date().toISOString() };
    store.addUser(user);
  }
  res.json({ token: issueToken(user.id), user: publicUser(user) });
});

// Brisanje naloga i svih podataka (Apple guideline 5.1.1(v) + GDPR)
app.delete("/auth/me", requireAuth, (req, res) => {
  store.deleteUser(req.userId);
  res.json({ deleted: true });
});

app.get("/auth/me", requireAuth, (req, res) => {
  const user = store.userById(req.userId);
  if (!user) return res.status(404).json({ error: "Nalog ne postoji" });
  res.json(publicUser(user));
});

function publicUser(u) { return { id: u.id, email: u.email, pro: !!u.pro }; }

// ---------- IAP (StoreKit 2) ----------
// Klijent šalje potpisanu StoreKit transakciju. MVP: prihvatamo transactionId + productId
// i markiramo pro. Produkcija: App Store Server API verifikacija (JWS potpis).
app.post("/iap/verify", requireAuth, (req, res) => {
  const { transactionId, productId } = req.body || {};
  const valid = transactionId && /^eraseline\.pro\.(monthly|yearly)$/.test(productId || "");
  if (!valid) return res.status(400).json({ error: "Nevažeća transakcija" });
  const user = store.updateUser(req.userId, { pro: true, proProduct: productId, proSince: new Date().toISOString() });
  res.json(publicUser(user));
});

// ---------- BROKERS & SCAN (scan je besplatan — to je hook) ----------
app.get("/brokers", (_req, res) => {
  res.json(BROKERS.map(({ id, name, baseUrl, checkMethod, optOut, exposes }) =>
    ({ id, name, baseUrl, checkMethod, optOut, exposes })));
});

app.post("/scan", requireAuth, async (req, res) => {
  const { first, last } = req.body || {};
  if (!first || !last) return res.status(400).json({ error: "first i last su obavezni" });
  try {
    const scan = await runScan(req.body);
    scan.userId = req.userId;
    store.addScan(scan);
    res.json(scan);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/scan/latest", requireAuth, (req, res) => {
  const s = store.scans().find(x => x.userId === req.userId) || null;
  if (!s) return res.status(404).json({ error: "Nema skenova još" });
  res.json(s);
});

// ---------- OPT-OUT (iza paywall-a: requireAuth + pro) ----------
app.post("/optout", requireAuth, pro, (req, res) => {
  const { brokerId, subject } = req.body || {};
  if (!brokerId || !subject?.first) return res.status(400).json({ error: "brokerId i subject su obavezni" });
  try {
    res.json(createOptOut({ brokerId, subject }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/optout/all", requireAuth, pro, (req, res) => {
  const scan = store.scans().find(x => x.userId === req.userId);
  if (!scan) return res.status(404).json({ error: "Prvo pokreni scan" });
  const targets = scan.results.filter(r => r.status === "exposed" || r.status === "likely_exposed");
  res.json(targets.map(t => createOptOut({ brokerId: t.brokerId, subject: scan.subject })));
});

app.get("/optout", requireAuth, (_req, res) => res.json(store.optouts()));

app.patch("/optout/:id", requireAuth, pro, (req, res) => {
  const o = store.updateOptOut(req.params.id, { status: req.body.status });
  if (!o) return res.status(404).json({ error: "Nije pronađen" });
  res.json(o);
});

// ---------- MONITORING ----------
app.post("/monitor", requireAuth, pro, (req, res) => {
  const { subject, intervalDays = 7 } = req.body || {};
  if (!subject?.first) return res.status(400).json({ error: "subject je obavezan" });
  const m = {
    subjectKey: `${subject.first}|${subject.last}`.toLowerCase(),
    userId: req.userId,
    subject, intervalDays,
    nextRunAt: new Date(Date.now() + intervalDays * 864e5).toISOString()
  };
  store.setMonitor(m);
  res.json(m);
});

app.get("/monitor", requireAuth, (_req, res) => res.json(store.monitors()));

const MONITOR_TICK_MS = 6 * 60 * 60 * 1000;
setInterval(async () => {
  for (const m of store.monitors()) {
    if (new Date(m.nextRunAt) <= new Date()) {
      const scan = await runScan(m.subject);
      scan.userId = m.userId;
      store.addScan(scan);
      m.nextRunAt = new Date(Date.now() + m.intervalDays * 864e5).toISOString();
      store.setMonitor(m);
      // TODO: APNs push ako je score pao
    }
  }
}, MONITOR_TICK_MS).unref();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Eraseline API na :${PORT}`));

export { app, computeScore };
