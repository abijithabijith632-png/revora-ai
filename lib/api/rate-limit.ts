import { RateLimitedError } from "@/lib/errors";

/**
 * In-memory sliding-window rate limiter.
 *
 * Development-safe, no Redis (locked stack). Not suitable for horizontally
 * scaled production (each instance has its own counter) — documented
 * limitation. Sensitive endpoints use this to prevent brute force/abuse.
 */

interface Window {
  timestamps: number[];
}

const buckets = new Map<string, Window>();

function prune(timestamps: number[], windowMs: number): number[] {
  const cutoff = Date.now() - windowMs;
  return timestamps.filter((t) => t > cutoff);
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): void {
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = prune(bucket.timestamps, windowMs);

  if (bucket.timestamps.length >= limit) {
    buckets.set(key, bucket);
    throw new RateLimitedError("Too many requests. Please try again later.");
  }

  bucket.timestamps.push(Date.now());
  buckets.set(key, bucket);
}

/** Identifier from a request (prefer userId, fall back to IP). */
export function rateLimitKey(userId: string | undefined, fallback: string): string {
  return userId ? `user:${userId}` : `ip:${fallback}`;
}
