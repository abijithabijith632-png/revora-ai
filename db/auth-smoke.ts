import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "./index";
import { users, organizations, authTokens, sessions, roles, userRoles } from "./schema";
import {
  register,
  verifyEmail,
  forgotPassword,
  resetPassword,
} from "@/lib/auth";
import { hashPassword, verifyPassword, passwordPolicy } from "@/lib/auth/password";
import { generateToken, hashToken } from "@/lib/auth/tokens";

/**
 * Phase 4 authentication smoke test — exercises the real service layer
 * against PostgreSQL, avoiding `next/headers` cookie calls (which require a
 * request context and are covered by the HTTP routes instead).
 */
const TEST_EMAIL = `smoke-${Date.now()}@revora.test`;

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAILED: ${label}`);
  console.log(`  ✓ ${label}`);
}

async function cleanup() {
  await db.delete(sessions);
  await db.delete(authTokens);

  const orgs = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.name, "Smoke Test Org"));
  const orgIds = orgs.map((o) => o.id);

  const u = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, TEST_EMAIL));
  const userIds = u.map((x) => x.id);

  if (userIds.length) {
    await db.delete(userRoles).where(inArray(userRoles.userId, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  }
  if (orgIds.length) {
    const r = await db.select({ id: roles.id }).from(roles).where(inArray(roles.organizationId, orgIds));
    const roleIds = r.map((x) => x.id);
    if (roleIds.length) {
      await db.delete(userRoles).where(inArray(userRoles.roleId, roleIds));
      await db.delete(roles).where(inArray(roles.id, roleIds));
    }
    await db.delete(organizations).where(inArray(organizations.id, orgIds));
  }
}

async function main() {
  console.log("[smoke] Starting authentication smoke test...");
  await cleanup();

  const pw = "Str0ng!Pass";

  // Password hashing + policy
  assert(verifyPassword(pw, hashPassword(pw)), "scrypt password hash/verify roundtrip");
  assert(!verifyPassword("wrong", hashPassword(pw)), "reject wrong password");
  assert(!passwordPolicy.safeParse("weak").success, "weak password rejected");
  assert(passwordPolicy.safeParse(pw).success, "strong password accepted");

  // Registration
  const reg = await register({
    fullName: "Smoke User",
    email: TEST_EMAIL,
    password: pw,
    confirmPassword: pw,
    organizationName: "Smoke Test Org",
  });
  assert(!!reg.userId, "registration creates user");

  const user = await db.query.users.findFirst({ where: eq(users.email, TEST_EMAIL) });
  assert(!!user, "user persisted");
  assert(user!.passwordHash !== pw && user!.passwordHash!.startsWith("scrypt$"), "password stored as scrypt hash");
  assert(!!user!.organizationId, "user belongs to organization");

  // Duplicate registration
  let dupRejected = false;
  try {
    await register({
      fullName: "Smoke User",
      email: TEST_EMAIL,
      password: pw,
      confirmPassword: pw,
      organizationName: "Another Org",
    });
  } catch {
    dupRejected = true;
  }
  assert(dupRejected, "duplicate email rejected");

  // Email verification
  const verifyToken = generateToken();
  await db.insert(authTokens).values({
    userId: user!.id,
    type: "email_verification",
    tokenHash: hashToken(verifyToken),
    expiresAt: new Date(Date.now() + 60000),
  });
  await verifyEmail(verifyToken);
  const verified = await db.query.users.findFirst({ where: eq(users.id, user!.id) });
  assert(!!verified!.emailVerifiedAt, "email verification marks verified");

  // Verification token single-use
  let reuseRejected = false;
  try {
    await verifyEmail(verifyToken);
  } catch {
    reuseRejected = true;
  }
  assert(reuseRejected, "verification token single-use enforced");

  // Forgot + reset password
  const resetToken = await forgotPassword({ email: TEST_EMAIL });
  assert(!!resetToken, "forgot password generates token");
  await resetPassword({ token: resetToken!, password: pw, confirmPassword: pw });
  const reset = await db.query.users.findFirst({ where: eq(users.id, user!.id) });
  assert(verifyPassword(pw, reset!.passwordHash!), "password reset applied");

  // Reset token single-use
  let resetReuseRejected = false;
  try {
    await resetPassword({ token: resetToken!, password: pw, confirmPassword: pw });
  } catch {
    resetReuseRejected = true;
  }
  assert(resetReuseRejected, "reset token single-use enforced");

  await cleanup();
  console.log("[smoke] All authentication smoke tests passed.");
}

main()
  .catch((err) => {
    console.error("[smoke] FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
