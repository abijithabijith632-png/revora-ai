"use client";

import { ThemeProvider } from "next-themes";
import { type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";

/**
 * Client-side providers boundary.
 *
 * Wraps `next-themes` (light/dark) and the toast feedback system. Any future
 * client context providers are composed here.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}
