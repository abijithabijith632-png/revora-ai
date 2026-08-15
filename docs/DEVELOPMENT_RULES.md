# Revora AI — Development Rules

These rules apply to **every** future phase. They preserve the architecture and
prevent rework.

## Locked Stack

1. Never replace the locked stack (Next.js + PostgreSQL).
2. Never create a separate backend service.
3. Never create a second database or switch databases.
4. Never introduce unauthorized technologies.

## Working With Existing Code

5. Inspect existing code before modifying anything.
6. Reuse existing components, services, and repositories.
7. Reuse existing database models — do not duplicate.
8. Never rewrite working modules unnecessarily.
9. Preserve previous phase behavior; fix regressions before declaring completion.
10. Do not duplicate functionality.

## Honesty & Completeness

11. Do not use fake completed functionality or present unfinished work as done.
12. Do not create fake AI outputs or placeholder business data in production UI.

## Security

13. Never hardcode secrets, tokens, keys, or credentials.
14. Keep secrets server-side; respect the `NEXT_PUBLIC_*` boundary.
15. Enforce tenant isolation server-side at the query level.

## Product Quality

16. Keep AI explainable (result, confidence, reasons, signals, recommendation).
17. Maintain the premium SaaS design system (tokens, no hardcoded colors).
18. Keep animations purposeful, subtle, and fast.
19. Keep 3D purposeful — never add unnecessary 3D.
20. Maintain responsive design across desktop, tablet, and mobile.
21. Maintain accessibility (semantic HTML, keyboard, focus, contrast, reduced motion).
22. Prefer maintainable, boring code over clever code.
23. Run lint, type check, and build after modifications.
24. Run tests after modifications (when test infrastructure is introduced).

## Success Condition

Every phase must leave the repository in a clean, working state so the next
phase starts directly on top of it without rebuilding the architecture.
