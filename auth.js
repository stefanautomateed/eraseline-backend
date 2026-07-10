import crypto from "node:crypto";

// Auth bez eksternih zavisnosti: scrypt hash lozinki + HMAC-potpisani tokeni.
// U produkciji: zameni sa jose/JWT + refresh tokeni, i drži SECRET u env-u.
const SECRET = process.env.AUTH_SECRET || "dev-secret-change-me";

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
}

export function issueToken(userId) {
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    iat: Date.now(),
    exp: Date.now() + 30 * 864e5 // 30 dana
  })).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyToken(token) {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const data = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (data.exp < Date.now()) return null;
  return data; // { sub, iat, exp }
}

// Express middleware
export function requireAuth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  const claims = verifyToken(token);
  if (!claims) return res.status(401).json({ error: "Neautorizovan — uloguj se." });
  req.userId = claims.sub;
  next();
}

// Pro pretplata (StoreKit potvrda) — vidi /iap/verify u server.js
export function requirePro(getUser) {
  return (req, res, next) => {
    const user = getUser(req.userId);
    if (!user?.pro) return res.status(402).json({ error: "Potrebna je Eraseline Pro pretplata." });
    next();
  };
}
