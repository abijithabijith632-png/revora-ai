"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Tooltip — contextual explainability helper.
 *
 * Lightweight, CSS-only positioning. Used to explain metrics, actions,
 * statuses, filters, and future AI predictions. Triggers on hover and
 * keyboard focus; hidden from assistive tech unless `label` is supplied.
 */
export function Tooltip({
  content,
  children,
  className,
  side = "top",
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 250);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 100);
  };

  const positionClass = {
    top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
    bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
    left: "right-full top-1/2 mr-2 -translate-y-1/2",
    right: "left-full top-1/2 ml-2 -translate-y-1/2",
  }[side];

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          id={id}
          className={cn(
            "absolute z-50 w-max max-w-xs rounded-md border border-border bg-elevated px-3 py-2 text-xs text-foreground shadow-lg",
            "pointer-events-none",
            positionClass,
            className,
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}

/**
 * Information icon button for inline "why?" explanations.
 * Reusable across metrics, settings, and AI results.
 */
export function InfoTip({ content }: { content: ReactNode }) {
  return (
    <Tooltip content={content}>
      <span
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border-strong text-[10px] font-semibold text-muted-foreground"
        aria-hidden="true"
      >
        ?
      </span>
    </Tooltip>
  );
}
