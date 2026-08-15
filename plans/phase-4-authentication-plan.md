# Revora AI — Phase 4 Plan: Authentication & Account Lifecycle

## Existing (reuse, do not rebuild)
- Zod validation + `parseAndValidate` ([`lib/validation`](lib/validation/index.ts))
- Error hierarchy ([`lib/errors`](lib/errors/index.ts)) incl. `UnauthorizedError`, `ValidationError`, `ConflictError`, `RateLimitedError`
- API envelope ([`lib/api/response.ts`](lib/api/response.ts))
- Phase 3 schema: `organizations`, `users`, `roles`, `permissions`, `user_roles`, `audit_logs`, `organization_settings`
- Phase 2 UI primitives (Button, Card, Input, FormField, etc.) + toast system
- Auth route shells: `/login`, `/register`, `/forgot-password` (in `(auth)` group), `/profile`, `/settings`

## Security approach (zero new dependencies)
- **Password hashing:** Node built-in `crypto.scrypt` (salt + derived key, stored as `scrypt$<salt>$<hash>`). No plaintext, no bcrypt dependency.
- **Tokens:** `crypto.randomBytes` → base64url raw token; store **SHA-256 hash** only. Single-use + expiry.
- **Sessions:** opaque random session token in an **HttpOnly, Secure (prod), SameSite=Lax** cookie; server stores SHA-256 hash in DB (`sessions` table) for revocable, server-side validation.
- **No localStorage** as auth boundary. No middleware/Edge runtime (which cannot use `pg`/Node crypto) — protection via Node-runtime Server Component layouts.

## Required minimal schema changes (small, documented)
1. `users.email` → global unique (required for unambiguous email+password login).
2. New `sessions` table (id, user_id FK, token_hash unique, expires_at, created_at).
3. New `auth_tokens` table (type enum: email_verification | password_reset; user_id FK, token_hash unique, expires_at, used_at, created_at).

## Modules (minimal, purposeful)
- [`lib/auth/password.ts`](lib/auth/password.ts) — scrypt hash/verify + password policy schema.
- [`lib/auth/tokens.ts`](lib/auth/tokens.ts) — random token + SHA-256 hash helpers.
- [`lib/auth/schemas.ts`](lib/auth/schemas.ts) — Zod: register, login, forgot, reset, change-password, profile.
- [`lib/auth/session.ts`](lib/auth/session.ts) — cookie constants + create/read/destroy session.
- [`lib/auth/service.ts`](lib/auth/service.ts) — register (transactional org+user+role), login, logout, verify email, resend, request/reset password, change password, get/update profile.
- Rewrite [`lib/auth/index.ts`](lib/auth/index.ts) — public `getSession`/`requireSession` + re-exports.
- [`db/schema/auth.ts`](db/schema/auth.ts) — sessions + auth_tokens + enum.

## Routes
**API (Route Handlers, standard envelope):**
- `POST /api/auth/register`, `login`, `logout`, `verify-email`, `resend-verification`, `forgot-password`, `reset-password`, `change-password`, `PATCH /api/auth/profile`, `GET /api/auth/session`

**Pages (Phase 2 design system):**
- `/login`, `/register`, `/forgot-password` (replace placeholders), new `/verify-email`, `/reset-password`
- `/settings/security` (change password), `/profile` (profile management)

**Protection:** `(app)/layout.tsx` → `requireSession()` else redirect `/login`; `(auth)/layout.tsx` → redirect `/dashboard` if already logged in.

## Auth UI components (reuse Phase 2 primitives + toast)
- `components/auth/login-form.tsx`, `register-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx`, `change-password-form.tsx`, `profile-form.tsx`
- Decorative CSS 3D orb on auth layout (non-blocking).

## Validation / testing
- typecheck, lint, build, migration, seed
- Integration smoke tests via script (register→login→session→logout, reset flow, duplicate, weak password, protected route).

## Deferred
RBAC enforcement (P5), CRM CRUD, admin account management, external email provider (dev-safe console/URL mechanism documented), distributed rate limiting (in-memory foundation only).
