"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * SHE Software Solutions brand mark + wordmark.
 *
 * Uses actual logo assets from /branding/ directory.
 * Supports light/dark theme switching.
 */
export function Logo({
  showWordmark = true,
  variant = "main",
  className,
}: {
  showWordmark?: boolean;
  variant?: "main" | "navbar";
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  if (variant === "navbar") {
    const src = isDark
      ? "/branding/she-navbar-dark.svg"
      : "/branding/she-navbar-light.svg";
    return (
      <span className={cn("inline-flex items-center", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="SHE Software Solutions"
          className="h-8 w-auto"
          draggable={false}
        />
      </span>
    );
  }

  const logoSrc = isDark
    ? "/branding/she-logo-dark.svg"
    : "/branding/she-logo-light.svg";

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoSrc}
        alt="SHE Software Solutions"
        className="h-8 w-auto"
        draggable={false}
      />
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            SHE Software Solutions
          </span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-faint">
            Sales Intelligence
          </span>
        </span>
      )}
    </span>
  );
}
