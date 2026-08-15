import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  organizations,
  users,
  roles,
  userRoles,
  authTokens,
  sessions,
  auditLogs,
} from "@/db/schema";
import {
  ValidationError,
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
} from "@/lib/errors";
import { hashPassword, verifyPassword } from "./password";
import { generateToken, hashToken } from "./tokens";
import {
  createSession,
  setSessionCookie,
  clearSessionCookie,
  getSession,
  SESSION_COOKIE,
  type AuthSession,
} from "./session";
import type {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
  UpdateProfileInput,
} from "./schemas";

/**
 * Authentication service — centralized account lifecycle business logic.
 * All DB access lives here (and in session.ts), not in UI components.
 */

const VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const RESET_TTL_MS = 1000 * 60 * 30; // 30m

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") + `-${Date.now().toString(36)}`
  );
}

function findUserByEmail(email: string) {
  return db.query.users.findFirst({ where: eq(users.email, email) });
}

/* -------------------------------------------------------------
 * Registration (transactional org + user + role)
 * ------------------------------------------------------------ */
export async function register(input: RegisterInput) {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw new ConflictError("An account with this email already exists.");
  }

  const passwordHash = hashPassword(input.password);

  const [createdUser] = await db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({ name: input.organizationName, slug: slugify(input.organizationName) })
      .returning({ id: organizations.id });

    const [user] = await tx
      .insert(users)
      .values({
        organizationId: org.id,
        email: input.email,
        fullName: input.fullName,
        passwordHash,
        status: "active",
      })
      .returning({ id: users.id, email: users.email, organizationId: users.organizationId });

    // Assign a default "Admin" role for the first user of the org.
    const [role] = await tx
      .insert(roles)
      .values({ organizationId: org.id, name: "Admin", isSystem: true })
      .returning({ id: roles.id });

    await tx.insert(userRoles).values({ userId: user.id, roleId: role.id });

    return [user];
  });

  // Issue verification token (raw returned once; only hash stored).
  const rawToken = generateToken();
  await db.insert(authTokens).values({
    userId: createdUser.id,
    type: "email_verification",
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
  });

  return { userId: createdUser.id, verificationToken: rawToken };
}

/* -------------------------------------------------------------
 * Login
 * ------------------------------------------------------------ */
export async function login(input: LoginInput) {
  const user = await findUserByEmail(input.email);
  // Uniform message to avoid account enumeration.
  const invalid = "Unable to sign in with those credentials.";

  if (!user || !user.passwordHash) {
    throw new UnauthorizedError(invalid);
  }
  if (!verifyPassword(input.password, user.passwordHash)) {
    throw new UnauthorizedError(invalid);
  }
  if (user.status !== "active") {
    throw new ForbiddenError(
      "Your account is currently unavailable. Contact your administrator.",
    );
  }

  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  const token = await createSession(user.id);
  await setSessionCookie(token);

  await db.insert(auditLogs).values({
    organizationId: user.organizationId,
    userId: user.id,
    action: "login",
    entityType: "user",
    entityId: user.id,
  });

  return { userId: user.id, organizationId: user.organizationId, email: user.email };
}

/* -------------------------------------------------------------
 * Logout
 * ------------------------------------------------------------ */
export async function logout() {
  const cookieStore = await import("next/headers").then((m) => m.cookies());
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  await clearSessionCookie();
}

/* -------------------------------------------------------------
 * Email verification
 * ------------------------------------------------------------ */
export async function verifyEmail(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const [token] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, tokenHash), eq(authTokens.type, "email_verification")))
    .limit(1);

  if (!token || token.usedAt || token.expiresAt.getTime() < Date.now()) {
    throw new ValidationError("Your verification link has expired or is invalid.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, token.userId));
    await tx
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(eq(authTokens.id, token.id));
  });
}

export async function resendVerification(email: string) {
  const user = await findUserByEmail(email);
  if (!user) {
    // Uniform response: do not reveal account existence.
    return;
  }
  if (user.emailVerifiedAt) return;

  const rawToken = generateToken();
  await db.insert(authTokens).values({
    userId: user.id,
    type: "email_verification",
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
  });
  return rawToken;
}

/* -------------------------------------------------------------
 * Forgot / reset password
 * ------------------------------------------------------------ */
export async function forgotPassword(input: ForgotPasswordInput) {
  const user = await findUserByEmail(input.email);
  if (!user) {
    // Uniform response — do not reveal account existence.
    return;
  }

  const rawToken = generateToken();
  await db.insert(authTokens).values({
    userId: user.id,
    type: "password_reset",
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  });
  return rawToken;
}

export async function resetPassword(input: ResetPasswordInput) {
  const tokenHash = hashToken(input.token);
  const [token] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, tokenHash), eq(authTokens.type, "password_reset")))
    .limit(1);

  if (!token || token.usedAt || token.expiresAt.getTime() < Date.now()) {
    throw new ValidationError("This password reset link has expired or is invalid.");
  }

  const passwordHash = hashPassword(input.password);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, token.userId));
    await tx
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(eq(authTokens.id, token.id));
    // Invalidate all existing sessions for the user.
    await tx.delete(sessions).where(eq(sessions.userId, token.userId));
  });
}

/* -------------------------------------------------------------
 * Change password (authenticated)
 * ------------------------------------------------------------ */
export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user || !user.passwordHash) throw new UnauthorizedError();
  if (!verifyPassword(input.currentPassword, user.passwordHash)) {
    throw new ValidationError("Current password is incorrect.");
  }

  const passwordHash = hashPassword(input.newPassword);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, userId));
    // Keep other sessions? Invalidate all except handled by re-login policy:
    // simplest safe default — invalidate all sessions.
    await tx.delete(sessions).where(eq(sessions.userId, userId));
  });

  // Create a fresh session so the user stays logged in.
  const token = await createSession(userId);
  await setSessionCookie(token);
}

/* -------------------------------------------------------------
 * Profile management
 * ------------------------------------------------------------ */
export async function getProfile(userId: string): Promise<AuthSession | null> {
  const session = await getSession();
  return session && session.userId === userId ? session : null;
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const [updated] = await db
    .update(users)
    .set({
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      jobTitle: users.jobTitle,
      avatarUrl: users.avatarUrl,
      organizationId: users.organizationId,
      status: users.status,
    });

  if (!updated) throw new NotFoundError("User not found.");
  return updated;
}

export { getSession } from "./session";
