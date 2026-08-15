import { createHash, randomBytes } from "node:crypto";

/**
 * Secure token utilities.
 *
 * - Raw tokens are cryptographically random (32 bytes → base64url).
 * - Only the SHA-256 hash of a token is stored/compared.
 * - Never log raw tokens.
 */

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
