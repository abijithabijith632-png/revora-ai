# Revora AI — Phase 5 Plan: RBAC, Roles, Permissions & Authorization

## Existing (reuse)
- Phase 3 schema: `roles`, `permissions`, `role_permissions`, `user_roles` (org-scoped)
- Phase 4 `requireSession()`/`getSession()` + `requirePermission` error patterns
- Phase 2 design system + audit_logs (Phase 3)

## Replace (stale)
- `lib/permissions/index.ts` — replace Phase 1 colon-style model with resource.action model matching Phase 3 schema.

## A. Centralized permission definitions
Rewrite [`lib/permissions/index.ts`](lib/permissions/index.ts):
- `ACTIONS = ["view","create","edit","delete","export","assign","approve"]`
- `RESOURCES` (20): dashboard, leads, clients, contacts, opportunities, pipeline, activities, tasks, meetings, proposals, documents, reports, analytics, notifications, users, roles, settings, audit_logs, ai_insights, organization
- `Permission = \`${Resource}.${Action}\``
- `ROLE_NAMES = ["Super Admin","Admin","Sales Manager","Sales Executive"]`
- `ROLE_PERMISSION_MATRIX` (role → Set<Permission>)
- `ROLE_RANK` for privilege-escalation ordering

## B. Authorization service
New [`lib/permissions/authorize.ts`](lib/permissions/authorize.ts):
- `getUserPermissions(userId, organizationId)` → one query (roles → permissions)
- `requirePermission(permission)` → session → perms → allow/throw `ForbiddenError`
- `getUserRoleNames(userId, orgId)`

## C. Session context
Extend `AuthSession` to include `roleNames: string[]` (resolve via user_roles in `getSession`).

## D. Server API authorization foundation
Route handlers: `requirePermission("leads.create")` etc. (used by future CRUD).

## E. RBAC management API (`/api/rbac/*`)
- `GET /api/rbac/roles` — org roles + permission matrix + user counts
- `GET /api/rbac/users` — org users + assigned roles
- `PATCH /api/rbac/users/[id]/role` — assign/change role (escalation-protected, org-scoped, audited)

## F. Pages (Phase 2 UI, protected by permission)
- `/settings/users` — user management (users.manage)
- `/settings/roles` — role management + permission matrix (roles.view / roles.edit)
- `/forbidden` — premium forbidden state

## G. UI authorization
- `nav.ts`: add `permission` to NavItem; sidebar filters by current user permissions.
- `Can` client component + `usePermission` for action visibility (UI-only; server remains authoritative).

## H. Escalation protection
`assignRole` validates: caller has `roles.assign`; target same org; caller rank > target rank; cannot self-escalate; target role exists in org.

## I. Audit
Record role assigned/changed in `audit_logs`.

## J. Seed
Add "Super Admin" role + full 4-role matrix; assign roles; register default role stays safe.

## K. Tests + validation
- RBAC smoke test: matrix, permission check, tenant isolation, escalation prevention.
- typecheck, lint, build.

## Deferred
Lead/client/contact/opportunity CRUD (P7+), AI, analytics engine, SaaS billing.
