# Revora AI — Phase 2 Plan: Premium Enterprise Design System

## Guiding Principle (from your note)
- Feature completeness + clean architecture + maintainability + **minimal complexity**.
- Group related functionality logically; share reusable components.
- **No new file/folder unless it has a clear architectural purpose.**
- **No new dependencies** — build everything with the existing locked stack (React + Tailwind v4 + lucide-react + next-themes).

## Existing Phase 1 (reuse, do not rebuild)
- Design tokens (light/dark) in `app/globals.css`
- `Button`, `Card`, `Badge`, `Input`, `Skeleton`
- `Sidebar`, `Topbar`, `AppShell`, `ThemeToggle`, `nav.ts`
- `AiOrb` (CSS 3D), `providers` (next-themes), `PagePlaceholder`
- `cn()` util, barrel exports

## Phase 2 Scope

### A. Design token & typography refinement (`app/globals.css`)
Enhance the existing token system (single source of truth) with:
- typography scale tokens
- spacing scale
- additional status text/fg tokens + AI states
- refined shadow elevation
- keep light + dark parity

### B. Branding — `components/ui/logo.tsx`
Revora AI logo mark + wordmark treatment.

### C. Enhance existing primitives (minimal edits)
- `button.tsx` — add `loading` state + spinner
- `card.tsx` — add subtle hover elevation (opt-in `interactive` prop)
- `badge.tsx` — add domain status variant map (lead/opportunity/risk/ai)
- `input.tsx` — add error/success visual states

### D. New UI primitives (each with clear purpose)
- `components/ui/form.tsx` — Label, Textarea, Select, Checkbox, Toggle, FormField (grouped form controls)
- `components/ui/tooltip.tsx` — hover/focus tooltip (contextual explainability)
- `components/ui/overlay.tsx` — Modal, Drawer, ConfirmDialog (grouped overlays; native dialog + focus mgmt)
- `components/ui/toast.tsx` — ToastProvider + useToast (grouped feedback system)
- `components/ui/table.tsx` — Table family (header/row/pagination/loading/empty)
- `components/ui/avatar.tsx` — Avatar (initials/image/status)
- `components/ui/states.tsx` — EmptyState, ErrorState, LoadingState (grouped states)
- `components/ui/kpi-card.tsx` — KPI card (title/value/trend/comparison/icon/tooltip)
- `components/ui/page-header.tsx` — PageHeader (title/description/actions)

### E. AI UI system — `components/ai/ai-insight-card.tsx`
Grouped AI components: `AiInsightCard`, `AiConfidence`, `AiProcessing`, AI status badges. Enhances existing `AiOrb`.

### F. Enhanced application shell
- `sidebar.tsx` — collapsed state, tooltips, user/profile area, org context
- `topbar.tsx` — global search placeholder, notifications, theme, profile

### G. Dashboard showcase
Update `app/(app)/dashboard/page.tsx` to demonstrate the design system with **clearly-labeled example/placeholder** content (no fake real data).

### H. Validation
Typecheck, lint, production build, manual visual checks (light/dark, responsive, reduced-motion).

## Deliberately NOT added
- No new npm dependencies (no Radix, no Headless UI, no framer-motion, no chart lib, no Three.js)
- No business logic / CRUD / real AI
- No separate CSS architecture (reuse `globals.css` token system)
