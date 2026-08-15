import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { getUserRoleNames } from "@/lib/permissions/authorize";
import { serverEnv } from "@/config/env";
import { generateToken, hashToken } from "./tokens";

/**
 * Session management — opaque random token in an HttpOnly, Secure (prod),
 * SameSite=Lax cookie. Server stores only the SHA-256 hash.
 */

export const SESSION_COOKIE = "revora_session";
const SESSION_TTL_MS = serverEnv.sessionTtlSeconds * 1000;

export interface AuthSession {
  userId: string;
  organizationId: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
  roleNames: string[];
}

export async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      userId: users.id,
      organizationId: users.organizationId,
      email: users.email,
      fullName: users.fullName,
      jobTitle: users.jobTitle,
      expiresAt: sessions.expiresAt,
      userStatus: users.status,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, hashToken(token)))
    .limit(1);

  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  if (row.userStatus !== "active") return null;

  const roleNames = await getUserRoleNames(row.userId, row.organizationId);

  return {
    userId: row.userId,
    organizationId: row.organizationId,
    email: row.email,
    fullName: row.fullName,
    jobTitle: row.jobTitle,
    roleNames,
  };
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: serverEnv.isProduction,
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + SESSION_TTL_MS),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: serverEnv.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
