import { cn } from "@/lib/utils";

/**
 * AI Orb — a purposeful, CSS-only 3D-style visual reserved for high-value
 * areas (AI Intelligence Hub / processing states). Implemented with pure
 * CSS transforms + gradient depth (no Three.js or 3D framework, per the
 * locked technology stack). Animations are defined in `app/globals.css`.
 *
 * Respects `prefers-reduced-motion` via the global reduced-motion rule.
 */
export function AiOrb({
  className,
  label = "AI Intelligence",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      role="img"
      aria-label={label}
    >
      {/* Soft ambient glow */}
      <div className="absolute inset-0 rounded-full bg-ai opacity-20 blur-3xl" />

      {/* Core orb */}
      <div className="ai-orb relative h-40 w-40 rounded-full">
        <div className="ai-orb-ring absolute inset-0 rounded-full" />
        <div className="ai-orb-core absolute inset-3 rounded-full" />
        <div className="ai-orb-spark absolute inset-0 rounded-full" />
      </div>
    </div>
  );
}
