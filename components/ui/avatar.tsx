import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Avatar — initials, optional image, and status indicator.
 */
export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  name: string;
  src?: string;
  /** online / offline / away / busy */
  status?: "online" | "offline" | "away" | "busy";
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-11 w-11 text-base",
};

const STATUS_COLORS = {
  online: "bg-success",
  offline: "bg-faint",
  away: "bg-warning",
  busy: "bg-danger",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + (parts.length > 1 ? last : "")).toUpperCase();
}

export function Avatar({
  name,
  src,
  status,
  size = "md",
  className,
  ...props
}: AvatarProps) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)} {...props}>
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700 dark:bg-brand-950/60 dark:text-brand-300",
          SIZE_CLASSES[size],
        )}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          initials(name)
        )}
      </span>
      {status && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-surface",
            STATUS_COLORS[status],
          )}
        />
      )}
    </span>
  );
}
