/**
 * Durable, PM2-restart-surviving rate limiter (Deploy 22).
 *
 * Same fixed-window design as the Deploy 20 proxy limiter (start.js), but for
 * app-level auth endpoints the proxy does not intercept — currently the
 * forgot-password and reset-password routes. Backed by the `auth_rate_limits`
 * SQLite table so counters survive a PM2 restart, unlike the in-memory
 * lib/rate-limit.ts used for non-critical paths.
 *
 * It never logs or stores tokens, passwords, email bodies, or SMTP secrets —
 * only an opaque bucket key (which callers hash / scope) and a counter.
 */
import { getDb } from "./db";

export type DurableRateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

let lastSweep = 0;

function sweep(nowIso: string): void {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  try {
    getDb().prepare("DELETE FROM auth_rate_limits WHERE reset_at <= ?").run(nowIso);
  } catch {
    // best-effort cleanup
  }
}

/**
 * Record a hit for `key` and report whether it is within `limit` per `windowMs`.
 * Atomic within the single-process better-sqlite3 connection.
 */
export function durableRateLimit(key: string, limit: number, windowMs: number): DurableRateLimitResult {
  const db = getDb();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  sweep(nowIso);

  const row = db.prepare("SELECT count, reset_at FROM auth_rate_limits WHERE bucket_key = ?").get(key) as
    | { count: number; reset_at: string }
    | undefined;

  const resetMs = row ? Date.parse(row.reset_at) : 0;
  if (!row || !Number.isFinite(resetMs) || resetMs <= now) {
    // New window.
    const resetAt = new Date(now + windowMs).toISOString();
    db.prepare(
      `INSERT INTO auth_rate_limits (bucket_key, count, reset_at) VALUES (?, 1, ?)
       ON CONFLICT(bucket_key) DO UPDATE SET count = 1, reset_at = excluded.reset_at`,
    ).run(key, resetAt);
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  const nextCount = row.count + 1;
  db.prepare("UPDATE auth_rate_limits SET count = ? WHERE bucket_key = ?").run(nextCount, key);
  if (nextCount > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((resetMs - now) / 1000)),
    };
  }
  return { allowed: true, remaining: Math.max(0, limit - nextCount), retryAfterSeconds: 0 };
}
