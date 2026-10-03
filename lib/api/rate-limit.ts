/**
 * Sliding-window rate limiter with a pluggable store.
 *
 * Default is in-memory (locked stack, no external service, dev-safe).
 * Limitation: counters are per-instance. On horizontally scaled / serverless
 * production (e.g. Vercel), counters are NOT shared across instances.
 * Set RATE_LIMIT_STORE to select a backend; only "memory" is bundled.
 * A shared store (e.g. Redis/Upstash) can be added later by implementing
 * RateLimitStore and selecting it via env, without changing call sites.
 */

export interface RateLimitStore {
  /** Return timestamps (ms) recorded for key within window, pruned. */
  take(key: string, limit: number, windowMs: number): boolean;
  /** For tests only. */
  clearAll?(): void;
}

class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, number[]>();

  take(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const cutoff = now - windowMs;
    const kept = (this.buckets.get(key) ?? []).filter((t) => t > cutoff);
    if (kept.length >= limit) {
      this.buckets.set(key, kept);
      return false;
    }
    kept.push(now);
    this.buckets.set(key, kept);
    return true;
  }

  clearAll(): void {
    this.buckets.clear();
  }
}

let activeStore: RateLimitStore = new MemoryRateLimitStore();
let activeStoreName = "memory";

/** Override the backing store (used by tests or future shared stores). */
export function setRateLimitStore(store: RateLimitStore, name = "custom"): void {
  activeStore = store;
  activeStoreName = name;
}

/** Currently active store name (from env or default). */
export function getRateLimitStoreName(): string {
  return process.env.RATE_LIMIT_STORE ?? activeStoreName;
}

import { RateLimitedError } from "@/lib/errors";

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): void {
  if (process.env.RATE_LIMIT_STORE && process.env.RATE_LIMIT_STORE !== "memory" && activeStoreName === "memory") {
    // Configured for a shared store that is not bundled: fail closed with a
    // clear message rather than silently using per-instance counters.
    throw new RateLimitedError(
      "Rate limiting is not configured for shared production use (RATE_LIMIT_STORE=" +
        process.env.RATE_LIMIT_STORE +
        ").",
    );
  }
  const allowed = activeStore.take(key, limit, windowMs);
  if (!allowed) {
    throw new RateLimitedError("Too many requests. Please try again later.");
  }
}

/** Reset in-memory counters (tests only). */
export function resetRateLimitForTests(): void {
  activeStore.clearAll?.();
}

/** Identifier from a request (prefer userId, fall back to IP). */
export function rateLimitKey(userId: string | undefined, fallback: string): string {
  return userId ? `user:${userId}` : `ip:${fallback}`;
}
