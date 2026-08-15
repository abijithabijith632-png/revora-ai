import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Logo } from "@/components/ui/logo";
import { AiOrb } from "@/components/ai";

/**
 * Auth route layout — minimal centered shell with branding and a decorative,
 * non-blocking CSS 3D orb (authentication remains fully functional without it).
 * Already-authenticated users are redirected to the dashboard.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div
        className="pointer-events-none absolute -top-24 opacity-40 blur-sm"
        aria-hidden="true"
      >
        <AiOrb className="scale-125" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo showWordmark />
        </div>
        {children}
      </div>
    </div>
  );
}
