"use client";

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Form design system — grouped form controls.
 * Shares the same tokens/states as `Input` for visual consistency.
 */

/* -------------------------------------------------------------
 * Field wrapper + Label
 * ------------------------------------------------------------ */
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const autoId = useId();
  const id = htmlFor ?? autoId;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="text-danger" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </Label>
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "text-sm font-medium text-foreground",
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------
 * Textarea
 * ------------------------------------------------------------ */
export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, error, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={error || undefined}
        className={cn(
          "min-h-24 w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground",
          "placeholder:text-faint transition-colors duration-fast",
          "hover:border-border-strong",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error ? "border-danger" : "border-border",
          className,
        )}
        {...props}
      />
    );
  },
);

/* -------------------------------------------------------------
 * Select
 * ------------------------------------------------------------ */
export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "flex h-10 w-full appearance-none rounded-md border border-border bg-surface px-3 py-2 pr-8 text-sm text-foreground",
          "transition-colors duration-fast hover:border-border-strong",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);

/* -------------------------------------------------------------
 * Checkbox
 * ------------------------------------------------------------ */
export type CheckboxProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function Checkbox({
  label,
  className,
  id,
  ...props
}: CheckboxProps) {
  const autoId = useId();
  const checkboxId = id ?? autoId;

  return (
    <label
      htmlFor={checkboxId}
      className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground"
    >
      <input
        id={checkboxId}
        type="checkbox"
        className={cn(
          "h-4 w-4 rounded border-border text-brand-600",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        {...props}
      />
      {label}
    </label>
  );
}

/* -------------------------------------------------------------
 * Toggle (switch)
 * ------------------------------------------------------------ */
export type ToggleProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function Toggle({ label, className, id, ...props }: ToggleProps) {
  const autoId = useId();
  const toggleId = id ?? autoId;

  return (
    <label
      htmlFor={toggleId}
      className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground"
    >
      <span className="relative inline-flex">
        <input
          id={toggleId}
          type="checkbox"
          className="peer sr-only"
          {...props}
        />
        <span
          className={cn(
            "h-5 w-9 rounded-full bg-surface-hover transition-colors duration-base",
            "peer-checked:bg-brand-600",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
            "after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-base",
            "peer-checked:after:translate-x-4",
            className,
          )}
        />
      </span>
      {label}
    </label>
  );
}
