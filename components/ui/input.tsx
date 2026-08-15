import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Visual error state. */
  error?: boolean;
  /** Visual success state. */
  success?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = "text", error, success, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={error || undefined}
      className={cn(
        "flex h-10 w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground",
        "placeholder:text-faint transition-colors duration-fast",
        "hover:border-border-strong",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        !error && !success && "border-border",
        error && "border-danger focus-visible:ring-danger",
        success && "border-success focus-visible:ring-success",
        className,
      )}
      {...props}
    />
  );
});
