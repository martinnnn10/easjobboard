// EAS Recruit — Proxy wrapper with email verification enforcement
// Prevents HTTP/1.1 keep-alive pool exhaustion during RSC prefetch
// Adds email verification requirement for new signups
const http = require("http");
const { spawn, execSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const EXTERNAL_PORT = parseInt(process.env.PORT || "3030", 10);
const INTERNAL_PORT = EXTERNAL_PORT + 1;
const BASE_URL = process.env.PUBLIC_BASE_URL || process.env.BASE_URL || "https://easrecruit.ai";

// ─── Kill any orphaned process on the internal port before starting ────────────
try {
  execSync(`fuser -k ${INTERNAL_PORT}/tcp 2>/dev/null`, { stdio: "ignore" });
} catch (e) { /* no process to kill — fine */ }

// ─── SMTP Config ───────────────────────────────────────────────────────────────
function getSmtpTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.office365.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: parseInt(process.env.SMTP_PORT || "587", 10) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function getFromEmail() {
  return process.env.FROM_EMAIL || process.env.SMTP_USER || "support@easrecruit.ai";
}

function getFromName() {
  return process.env.FROM_NAME || "EAS Recruit";
}

// ─── SQLite DB for verification tokens ─────────────────────────────────────────
let db;
function getDb() {
  if (!db) {
    const Database = require("better-sqlite3");
    const dataDir = path.join(__dirname, "data");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    db = new Database(path.join(dataDir, "jobs.db"));
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used_at TEXT DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_verification_tokens_user ON email_verification_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_verification_tokens_hash ON email_verification_tokens(token_hash);
    `);
    // Migration bookkeeping + durable (SQLite) rate-limit store.
    db.exec(`
      CREATE TABLE IF NOT EXISTS proxy_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS proxy_rate_limits (
        bucket TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rate_limits_expiry ON proxy_rate_limits(expires_at);
    `);
  }
  return db;
}

// Users-table migration. Kept OUT of getDb() because the users table is owned
// by the Next app and may not exist yet on a brand-new database; this runs once
// the app is confirmed ready (see startProxy). Idempotent and crash-safe.
let userMigrationDone = false;
function ensureUserVerification() {
  if (userMigrationDone) return;
  try {
    const d = getDb();
    if (!d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get()) return;
    try {
      d.exec(`ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0`);
      console.log("[verify] Added email_verified column to users table");
    } catch (e) { /* Column already exists */ }
    // One-time legacy backfill: users that already existed when email
    // verification was introduced are grandfathered as verified. Guarded by
    // proxy_migrations so it runs EXACTLY ONCE per database — never again on a
    // PM2 restart / reboot / rebuild. This is the fix for the "auto-verify on
    // restart" bug: newly registered, unverified users are no longer
    // re-verified by a boot.
    const BACKFILL = "backfill_legacy_email_verified_v1";
    if (!d.prepare("SELECT 1 FROM proxy_migrations WHERE name = ?").get(BACKFILL)) {
      const runBackfill = d.transaction(() => {
        const res = d
          .prepare("UPDATE users SET email_verified = 1 WHERE email_verified = 0 OR email_verified IS NULL")
          .run();
        d.prepare("INSERT INTO proxy_migrations (name, applied_at) VALUES (?, ?)").run(BACKFILL, new Date().toISOString());
        return res.changes;
      });
      const changed = runBackfill();
      console.log(`[verify] Legacy email-verified backfill applied once (${changed} user(s) grandfathered)`);
    }
    userMigrationDone = true;
  } catch (e) {
    console.error("[verify] user migration deferred:", e.message);
  }
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createVerificationToken(userId, email) {
  const d = getDb();
  d.prepare("DELETE FROM email_verification_tokens WHERE user_id = ? AND used_at = ''").run(userId);
  const token = crypto.randomBytes(32).toString("hex");
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  d.prepare(`INSERT INTO email_verification_tokens (id, user_id, email, token_hash, expires_at, used_at, created_at)
    VALUES (?, ?, ?, ?, ?, '', ?)`).run(id, userId, email, hashToken(token), expiresAt, new Date().toISOString());
  return token;
}

function verifyToken(token) {
  const d = getDb();
  const hash = hashToken(token);
  const row = d.prepare("SELECT user_id, email, expires_at, used_at FROM email_verification_tokens WHERE token_hash = ?").get(hash);
  if (!row) return { valid: false, error: "Invalid verification link." };
  if (row.used_at) return { valid: false, error: "This link has already been used." };
  if (Date.parse(row.expires_at) < Date.now()) return { valid: false, error: "This verification link has expired. Please sign up again." };
  const changes = d.prepare("UPDATE email_verification_tokens SET used_at = ? WHERE token_hash = ? AND used_at = ''").run(new Date().toISOString(), hash).changes;
  if (changes === 0) return { valid: false, error: "This link has already been used." };
  d.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(row.user_id);
  return { valid: true, userId: row.user_id, email: row.email };
}

function isUserVerified(email) {
  const d = getDb();
  const user = d.prepare("SELECT id, email_verified FROM users WHERE email = ?").get(email);
  if (!user) return true; // user doesn't exist yet — let signup/login handle it
  if (user.email_verified === 1) return true;
  // Only gate accounts that went through the signup email-verification path
  // (they have a verification token). Invited teammates never receive a
  // verification token — the owner vouches for them and they use the temp-
  // password flow — so they must not be blocked at login.
  const hasToken = d.prepare("SELECT 1 FROM email_verification_tokens WHERE user_id = ? LIMIT 1").get(user.id);
  return !hasToken;
}

function getUserByEmail(email) {
  const d = getDb();
  return d.prepare("SELECT id, email, name, email_verified FROM users WHERE email = ?").get(email);
}

// ─── Rate limiting (durable, SQLite-backed) ─────────────────────────────────────
// Number of trusted proxy hops in front of this process (Nginx = 1). Only the
// IP appended by our own trusted proxy is believed; client-supplied
// X-Forwarded-For entries before it cannot shift the rate-limit key.
const TRUSTED_PROXY_HOPS = parseInt(process.env.TRUSTED_PROXY_HOPS || "1", 10);

function normalizeIp(req) {
  let ip = "";
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    // Trust the Nth-from-the-end entry (the one our own proxy appended).
    const idx = parts.length - TRUSTED_PROXY_HOPS;
    if (idx >= 0 && idx < parts.length) ip = parts[idx];
  }
  if (!ip && req.socket && req.socket.remoteAddress) ip = req.socket.remoteAddress;
  if (!ip) ip = "unknown";
  return ip.replace(/^::ffff:/, "").replace(/^\[|\]$/g, "").split("%")[0];
}

let lastRateCleanup = 0;
function cleanupRateLimits(force) {
  const now = Date.now();
  if (!force && now - lastRateCleanup < 60_000) return;
  lastRateCleanup = now;
  try {
    getDb().prepare("DELETE FROM proxy_rate_limits WHERE expires_at < ?").run(now);
  } catch (e) { /* best-effort */ }
}

/**
 * Fixed-window counter. Increments the (action, key) bucket for the current
 * window and returns { limited, retryAfter } once `limit` is exceeded. Durable
 * across restarts (SQLite) and bounded (expired buckets are pruned).
 */
function rateLimit(action, key, limit, windowMs) {
  const d = getDb();
  const now = Date.now();
  cleanupRateLimits(false);
  const windowId = Math.floor(now / windowMs);
  const bucket = `${action}:${key}:${windowId}`;
  const expiresAt = (windowId + 1) * windowMs;
  d.prepare(
    `INSERT INTO proxy_rate_limits (bucket, count, expires_at) VALUES (?, 1, ?)
     ON CONFLICT(bucket) DO UPDATE SET count = count + 1`,
  ).run(bucket, expiresAt);
  const row = d.prepare("SELECT count FROM proxy_rate_limits WHERE bucket = ?").get(bucket);
  const count = row ? row.count : 1;
  if (count > limit) {
    return { limited: true, retryAfter: Math.max(1, Math.ceil((expiresAt - now) / 1000)) };
  }
  return { limited: false, retryAfter: 0 };
}

function tooManyRequests(res, retryAfter) {
  res.writeHead(429, {
    "Content-Type": "application/json",
    "Retry-After": String(retryAfter),
    connection: "close",
  });
  res.end(JSON.stringify({ error: "Too many attempts. Please wait a bit and try again." }));
}

// Safe-default limits (overridable via env). Windows in ms.
const RL = {
  register: { limit: parseInt(process.env.RL_REGISTER || "5", 10), windowMs: 15 * 60_000 },
  login: { limit: parseInt(process.env.RL_LOGIN || "10", 10), windowMs: 15 * 60_000 },
  resend: { limit: parseInt(process.env.RL_RESEND || "3", 10), windowMs: 60 * 60_000 },
};

// ─── Email Sending ─────────────────────────────────────────────────────────────
async function sendVerificationEmail(email, name, token) {
  const verifyUrl = `${BASE_URL}/verify-email?token=${token}`;
  const transporter = getSmtpTransporter();
  await transporter.sendMail({
    from: `"${getFromName()}" <${getFromEmail()}>`,
    to: email,
    subject: `Verify your email — ${getFromName()}`,
    text: [
      `Hi ${name || "there"},`,
      "",
      `Welcome to ${getFromName()}! Please verify your email address to activate your account.`,
      "",
      "Click the link below (or copy and paste it into your browser):",
      "",
      verifyUrl,
      "",
      "This link expires in 24 hours.",
      "",
      "If you didn't create this account, you can safely ignore this email.",
      "",
      `— The ${getFromName()} Team`,
    ].join("\n"),
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #1a1a1a; font-size: 24px; margin: 0;">Verify your email</h1>
        </div>
        <p style="color: #333; font-size: 16px; line-height: 1.6;">Hi ${name || "there"},</p>
        <p style="color: #333; font-size: 16px; line-height: 1.6;">Welcome to <strong>${getFromName()}</strong>! Please verify your email address to activate your account.</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verifyUrl}" style="display: inline-block; background-color: #4d7c0f; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 600;">Verify Email Address</a>
        </div>
        <p style="color: #666; font-size: 14px; line-height: 1.5;">Or copy and paste this link into your browser:</p>
        <p style="color: #4d7c0f; font-size: 14px; word-break: break-all;">${verifyUrl}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
        <p style="color: #999; font-size: 12px;">This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.</p>
      </div>
    `,
  });
  console.log(`[verify] Verification email sent to ${email}`);
}

// ─── Verification Page HTML ────────────────────────────────────────────────────
function verificationPendingPage() {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Verify Your Email — EAS Recruit</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.card{background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:48px;max-width:440px;text-align:center}h1{color:#1a1a1a;font-size:24px;margin:0 0 16px}p{color:#555;font-size:16px;line-height:1.6;margin:0 0 12px}.icon{font-size:48px;margin-bottom:16px}.btn{display:inline-block;background:#4d7c0f;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;margin-top:20px}.btn:hover{background:#3f6212}.muted{color:#999;font-size:13px;margin-top:16px}</style></head>
<body><div class="card"><div class="icon">&#x1F4E7;</div><h1>Check your email</h1><p>We sent a verification link to your email address. Please click it to activate your account.</p><p class="muted">The link expires in 24 hours. Check your spam folder if you don't see it.</p><a href="/login" class="btn">Go to Login</a></div></body></html>`;
}

function verificationResultPage(success, message) {
  const icon = success ? "&#x2705;" : "&#x274C;";
  const title = success ? "Email Verified!" : "Verification Failed";
  const btnText = success ? "Sign In" : "Try Again";
  const btnHref = success ? "/login" : "/signup";
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — EAS Recruit</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.card{background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:48px;max-width:440px;text-align:center}h1{color:#1a1a1a;font-size:24px;margin:0 0 16px}p{color:#555;font-size:16px;line-height:1.6;margin:0 0 12px}.icon{font-size:48px;margin-bottom:16px}.btn{display:inline-block;background:#4d7c0f;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;margin-top:20px}.btn:hover{background:#3f6212}</style></head>
<body><div class="card"><div class="icon">${icon}</div><h1>${title}</h1><p>${message}</p><a href="${btnHref}" class="btn">${btnText}</a></div></body></html>`;
}

// ─── Request Body Parser ───────────────────────────────────────────────────────
function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// ─── Start Next.js on internal port ────────────────────────────────────────────
const child = spawn("node", ["server.js"], {
  cwd: __dirname,
  env: { ...process.env, PORT: String(INTERNAL_PORT), HOSTNAME: "127.0.0.1" },
  stdio: "inherit",
});

child.on("exit", (code) => {
  console.error(`[start.js] server.js exited with code ${code}`);
  process.exit(code || 1);
});

// Ensure child is killed when this process exits
function cleanup() {
  if (child && !child.killed) {
    child.kill("SIGTERM");
    setTimeout(() => {
      if (!child.killed) child.kill("SIGKILL");
    }, 2000);
  }
}
process.on("SIGTERM", () => { cleanup(); setTimeout(() => process.exit(0), 2500); });
process.on("SIGINT", () => { cleanup(); setTimeout(() => process.exit(0), 2500); });
process.on("exit", cleanup);

// ─── Wait for Next.js to be ready, then start proxy ───────────────────────────
function waitForReady(attempts = 0) {
  if (attempts > 30) {
    console.error("[start.js] Next.js failed to start after 30 attempts");
    process.exit(1);
  }
  const req = http.get(`http://127.0.0.1:${INTERNAL_PORT}/api/health`, (res) => {
    if (res.statusCode === 200) {
      console.log("[start.js] Next.js is ready, starting proxy...");
      startProxy();
    } else {
      setTimeout(() => waitForReady(attempts + 1), 1000);
    }
    res.resume();
  });
  req.on("error", () => {
    setTimeout(() => waitForReady(attempts + 1), 1000);
  });
  req.setTimeout(2000, () => { req.destroy(); setTimeout(() => waitForReady(attempts + 1), 1000); });
}

// Start checking after 2 seconds
setTimeout(() => {
  getDb(); // Initialize DB tables + run one-time migrations
  cleanupRateLimits(true);
  setInterval(() => cleanupRateLimits(true), 10 * 60_000).unref();
  waitForReady();
}, 2000);

function startProxy() {
  // Now that the Next app is ready, the users table exists — run the one-time
  // email_verified column + legacy backfill migration safely.
  ensureUserVerification();

  const proxy = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${EXTERNAL_PORT}`);

    // ─── Handle GET /verify-email?token=xxx ──────────────────────────────────
    if (req.method === "GET" && url.pathname === "/verify-email") {
      const token = url.searchParams.get("token");
      if (!token) {
        res.writeHead(400, { "Content-Type": "text/html", connection: "close" });
        res.end(verificationResultPage(false, "Missing verification token."));
        return;
      }
      const result = verifyToken(token);
      if (result.valid) {
        res.writeHead(200, { "Content-Type": "text/html", connection: "close" });
        res.end(verificationResultPage(true, "Your email has been verified. You can now sign in to your account."));
      } else {
        res.writeHead(400, { "Content-Type": "text/html", connection: "close" });
        res.end(verificationResultPage(false, result.error));
      }
      return;
    }

    // ─── Handle POST /api/auth/resend-verification ───────────────────────────
    if (req.method === "POST" && url.pathname === "/api/auth/resend-verification") {
      const ipLimit = rateLimit("resend", "ip:" + normalizeIp(req), RL.resend.limit, RL.resend.windowMs);
      if (ipLimit.limited) { tooManyRequests(res, ipLimit.retryAfter); return; }
      try {
        const body = await collectBody(req);
        const data = JSON.parse(body.toString());
        const email = (data.email || "").trim().toLowerCase();
        if (!email) {
          res.writeHead(400, { "Content-Type": "application/json", connection: "close" });
          res.end(JSON.stringify({ error: "Email is required." }));
          return;
        }
        // Also cap per-account so one address can't be flooded from many IPs.
        // Generic 429 for any email — reveals nothing about account existence.
        const emailLimit = rateLimit("resend", "email:" + email, RL.resend.limit, RL.resend.windowMs);
        if (emailLimit.limited) { tooManyRequests(res, emailLimit.retryAfter); return; }
        const user = getUserByEmail(email);
        if (user && !user.email_verified) {
          const token = createVerificationToken(user.id, email);
          await sendVerificationEmail(email, user.name, token);
        }
        // Always return success to prevent email enumeration
        res.writeHead(200, { "Content-Type": "application/json", connection: "close" });
        res.end(JSON.stringify({ ok: true, message: "If an account exists for that email, we've sent a new verification link." }));
      } catch (e) {
        console.error("[verify] Resend error:", e);
        res.writeHead(500, { "Content-Type": "application/json", connection: "close" });
        res.end(JSON.stringify({ error: "Failed to resend verification email." }));
      }
      return;
    }

    // ─── Intercept POST /api/auth/signup — send verification after signup ────
    if (req.method === "POST" && url.pathname === "/api/auth/signup") {
      const regLimit = rateLimit("register", "ip:" + normalizeIp(req), RL.register.limit, RL.register.windowMs);
      if (regLimit.limited) { tooManyRequests(res, regLimit.retryAfter); return; }
      const body = await collectBody(req);
      let signupData;
      try { signupData = JSON.parse(body.toString()); } catch (e) { signupData = {}; }

      const proxyReq = http.request({
        hostname: "127.0.0.1",
        port: INTERNAL_PORT,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, "content-length": body.length },
      }, async (proxyRes) => {
        const resChunks = [];
        proxyRes.on("data", (c) => resChunks.push(c));
        proxyRes.on("end", async () => {
          const resBody = Buffer.concat(resChunks);
          const resStr = resBody.toString();

          if (proxyRes.statusCode === 201) {
            try {
              const email = (signupData.adminEmail || "").trim().toLowerCase();
              const name = signupData.adminName || "";
              if (email) {
                const user = getUserByEmail(email);
                if (user) {
                  getDb().prepare("UPDATE users SET email_verified = 0 WHERE id = ?").run(user.id);
                  const token = createVerificationToken(user.id, email);
                  await sendVerificationEmail(email, name, token);
                  console.log(`[verify] New signup: ${email} — verification email sent`);
                }
              }
            } catch (e) {
              console.error("[verify] Failed to send verification email:", e);
            }
            // Strip the session cookie so user can't auto-login without verifying
            const headers = { ...proxyRes.headers, connection: "close" };
            delete headers["set-cookie"];
            res.writeHead(201, headers);
            res.end(JSON.stringify({
              ...JSON.parse(resStr),
              requiresVerification: true,
              message: "Account created! Please check your email to verify your address.",
            }));
          } else {
            const headers = { ...proxyRes.headers, connection: "close" };
            res.writeHead(proxyRes.statusCode, headers);
            res.end(resBody);
          }
        });
      });
      proxyReq.on("error", (err) => {
        console.error(`[proxy] signup error: ${err.message}`);
        if (!res.headersSent) {
          res.writeHead(502, { "Content-Type": "text/plain", connection: "close" });
          res.end("Bad Gateway");
        }
      });
      proxyReq.write(body);
      proxyReq.end();
      return;
    }

    // ─── Intercept POST /api/auth/login — block unverified users ─────────────
    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      const loginLimit = rateLimit("login", "ip:" + normalizeIp(req), RL.login.limit, RL.login.windowMs);
      if (loginLimit.limited) { tooManyRequests(res, loginLimit.retryAfter); return; }
      const body = await collectBody(req);
      let loginData;
      try { loginData = JSON.parse(body.toString()); } catch (e) { loginData = {}; }
      const email = (loginData.email || "").trim().toLowerCase();

      if (email && !isUserVerified(email)) {
        res.writeHead(403, { "Content-Type": "application/json", connection: "close" });
        res.end(JSON.stringify({
          error: "Please verify your email address before signing in. Check your inbox for the verification link.",
          requiresVerification: true,
          email: email,
        }));
        return;
      }

      // Forward to Next.js
      const proxyReq = http.request({
        hostname: "127.0.0.1",
        port: INTERNAL_PORT,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, "content-length": body.length },
      }, (proxyRes) => {
        const headers = { ...proxyRes.headers, connection: "close" };
        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res);
      });
      proxyReq.on("error", (err) => {
        console.error(`[proxy] login error: ${err.message}`);
        if (!res.headersSent) {
          res.writeHead(502, { "Content-Type": "text/plain", connection: "close" });
          res.end("Bad Gateway");
        }
      });
      proxyReq.write(body);
      proxyReq.end();
      return;
    }

    // ─── Default proxy passthrough ───────────────────────────────────────────
    const opts = {
      hostname: "127.0.0.1",
      port: INTERNAL_PORT,
      path: req.url,
      method: req.method,
      headers: req.headers,
    };
    const proxyReq = http.request(opts, (proxyRes) => {
      const headers = { ...proxyRes.headers, connection: "close" };
      res.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(res);
    });
    proxyReq.on("error", (err) => {
      console.error(`[proxy] ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "text/plain", connection: "close" });
        res.end("Bad Gateway");
      }
    });
    req.pipe(proxyReq);
  });

  proxy.listen(EXTERNAL_PORT, "0.0.0.0", () => {
    console.log(`[start.js] Proxy listening on :${EXTERNAL_PORT} -> :${INTERNAL_PORT} (email verification enabled)`);
  });
}
