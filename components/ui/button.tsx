import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Button primitive with purposeful micro-interactions:
 * - hover: subtle lift + background change
 * - focus: visible ring (accessibility)
 * - active: slight scale-down / downward translation
 * - loading: inline spinner + disabled behavior
 *
 * Variants map to design tokens only (no hardcoded colors).
 */

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800",
  secondary:
    "bg-surface-subtle text-foreground border border-border hover:bg-surface-hover active:bg-surface",
  ghost:
    "bg-transparent text-muted-foreground hover:bg-surface-hover hover:text-foreground",
  outline:
    "bg-transparent border border-border-strong text-foreground hover:bg-surface-subtle",
  danger:
    "bg-danger text-white shadow-sm hover:opacity-90 active:opacity-100",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
  icon: "h-10 w-10",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      className,
      type,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium",
          "transition-[transform,background-color,border-color,color,box-shadow,opacity]",
          "duration-fast ease-out select-none whitespace-nowrap",
          "hover:-translate-y-px active:translate-y-px active:scale-[0.98]",
          "disabled:pointer-events-none disabled:opacity-50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className,
        )}
        {...props}
      >
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        )}
        {children}
      </button>
    );
  },
);
