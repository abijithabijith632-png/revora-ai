/**
 * Shared utility helpers. Keep pure and side-effect free.
 */

/**
 * Merge conditional class names.
 * Usage: `cn("base", isActive && "active")`
 */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Format a Date as an ISO-like local timestamp for UI display.
 * Kept minimal for Phase 1; extended in later phases.
 */
export function formatDate(
  date: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  }).format(d);
}
