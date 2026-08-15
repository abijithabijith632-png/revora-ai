import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { serverEnv } from "@/config/env";

/**
 * Password hashing + policy.
 *
 * Uses Node's built-in `scrypt` with a per-password random salt and a
 * server-side pepper (AUTH_SECRET). Stored format: `scrypt$<salt>$<hash>`.
 * No plaintext is ever persisted.
 */

const KEY_LENGTH = 64;

/** Password policy (server-authoritative). */
export const passwordPolicy = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter.")
  .regex(/[a-z]/, "Password must include at least one lowercase letter.")
  .regex(/[0-9]/, "Password must include at least one number.")
  .regex(
    /[^A-Za-z0-9]/,
    "Password must include at least one special character.",
  );

function pepperPassword(password: string): string {
  return `${password}:${serverEnv.authSecret}`;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(pepperPassword(password), salt, KEY_LENGTH);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hashHex] = parts;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(pepperPassword(password), salt, KEY_LENGTH);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
