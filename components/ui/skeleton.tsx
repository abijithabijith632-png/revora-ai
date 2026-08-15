import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Skeleton loading primitive for polished loading states.
 */
export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-surface-hover",
        className,
      )}
      {...props}
    />
  );
}
