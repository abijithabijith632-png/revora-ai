import { UnauthorizedError } from "@/lib/errors";
import { getSession as resolveSession, type AuthSession } from "./session";

/**
 * Public authentication API.
 *
 * `getSession()` resolves the authenticated user + organization context from
 * the secure HttpOnly cookie. `requireSession()` throws `UnauthorizedError`
 * when unauthenticated (for server components, layouts, and route handlers).
 */

export async function getSession(): Promise<AuthSession | null> {
  return resolveSession();
}

export async function requireSession(): Promise<AuthSession> {
  const session = await resolveSession();
  if (!session) {
    throw new UnauthorizedError("Authentication required.");
  }
  return session;
}

export type { AuthSession } from "./session";
export {
  register,
  login,
  logout,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
  updateProfile,
} from "./service";
export {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
} from "./schemas";
export type {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
  UpdateProfileInput,
} from "./schemas";
