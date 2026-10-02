import { createHash } from "node:crypto";

/**
 * Feature Owner: Divij Anand
 * SERVER ONLY. In-memory guards for the AI routes: a small response cache and a
 * per-visitor rate limit. Both are per server instance, which is fine for the
 * MVP; a deployed version would move them to shared storage (e.g. Redis).
 * The clock is injectable so tests can run without waiting.
 */

type Clock = () => number;

// ---------- Response cache ----------

export interface ResponseCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  size(): number;
}

/** Least-recently-used cache with a time-to-live. */
export function createResponseCache<T>({
  ttlMs,
  maxEntries,
  now = Date.now,
}: {
  ttlMs: number;
  maxEntries: number;
  now?: Clock;
}): ResponseCache<T> {
  const entries = new Map<string, { value: T; expires: number }>();
  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expires <= now()) {
        entries.delete(key);
        return undefined;
      }
      // Refresh recency.
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    set(key, value) {
      entries.delete(key);
      entries.set(key, { value, expires: now() + ttlMs });
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value as string);
    },
    size: () => entries.size,
  };
}

/** Stable cache key for a Gemini call (hash only, so cached prompts never sit in logs). */
export function cacheKey(parts: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

// ---------- Rate limit ----------

export interface RateLimiter {
  /** Returns 0 if allowed, otherwise how many seconds to wait. */
  check(visitor: string): number;
}

/** Token bucket: `capacity` requests in a burst, refilled at `capacity` per `windowMs`. */
export function createRateLimiter({
  capacity,
  windowMs,
  now = Date.now,
  maxVisitors = 5000,
}: {
  capacity: number;
  windowMs: number;
  now?: Clock;
  maxVisitors?: number;
}): RateLimiter {
  const buckets = new Map<string, { tokens: number; updated: number }>();
  const refillPerMs = capacity / windowMs;
  return {
    check(visitor) {
      const t = now();
      const bucket = buckets.get(visitor) ?? { tokens: capacity, updated: t };
      bucket.tokens = Math.min(capacity, bucket.tokens + (t - bucket.updated) * refillPerMs);
      bucket.updated = t;
      buckets.delete(visitor);
      buckets.set(visitor, bucket);
      while (buckets.size > maxVisitors) buckets.delete(buckets.keys().next().value as string);
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return 0;
      }
      return Math.max(1, Math.ceil((1 - bucket.tokens) / refillPerMs / 1000));
    },
  };
}

/** Best-effort visitor id from proxy headers; local development falls back to one shared id. */
export function visitorId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "local";
}
