/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * This deployment runs as a single Node process (PM2 + local SQLite), so an
 * in-process store is sufficient and avoids adding infrastructure. If the app
 * is ever scaled to multiple instances, swap this for a shared store (Redis).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

/** Drop expired buckets occasionally so the map does not grow unbounded. */
function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Records a hit for `key` and reports whether it is within `limit` per `windowMs`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return { allowed: true, remaining: limit - existing.count, retryAfterSeconds: 0 };
}

/**
 * Number of trusted reverse-proxy hops in front of this app. Matches the
 * source-controlled start.js proxy's TRUSTED_PROXY_HOPS so the app and proxy
 * agree on which X-Forwarded-For entry is the real client.
 */
const TRUSTED_PROXY_HOPS = Math.max(1, parseInt(process.env.TRUSTED_PROXY_HOPS || "1", 10) || 1);

/** Strip IPv6-mapped prefix, brackets, and zone id so keys are stable. */
function cleanIp(ip: string): string {
  const out = ip.replace(/^::ffff:/i, "").replace(/^\[|\]$/g, "").split("%")[0];
  return out || "unknown";
}

/**
 * Trusted client IP for rate-limit keys.
 *
 * The app runs behind Nginx → the start.js proxy → Next. Nginx appends the real
 * peer to X-Forwarded-For and the proxy forwards the header unchanged, so the
 * trusted client is the Nth-from-the-END entry (the hop our own edge appended) —
 * NOT the first entry, which is entirely attacker-controlled. Taking the first
 * entry let an attacker rotate X-Forwarded-For to mint a fresh rate-limit bucket
 * on every request, defeating the limit. This mirrors start.js `normalizeIp`.
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) {
      const idx = parts.length - TRUSTED_PROXY_HOPS;
      return cleanIp(parts[idx >= 0 ? idx : parts.length - 1]);
    }
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return cleanIp(real);
  return "unknown";
}
