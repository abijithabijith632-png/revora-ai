import { cn } from "@/lib/utils";

/**
 * Revora AI brand mark + wordmark.
 *
 * The mark is a compact "R" monogram with an AI accent dot, suitable for
 * the sidebar, topbar, and auth surfaces. Pure CSS/Tailwind — no assets.
 */
export function Logo({
  showWordmark = true,
  className,
}: {
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-brand-500 via-brand-600 to-ai shadow-sm">
        <span className="text-sm font-bold leading-none text-white">R</span>
        <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-white/90" />
      </span>
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Revora
            <span className="text-brand-600"> AI</span>
          </span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-faint">
            Sales Intelligence
          </span>
        </span>
      )}
    </span>
  );
}
