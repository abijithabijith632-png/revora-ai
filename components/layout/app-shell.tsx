"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { PermissionProvider } from "@/components/auth/can";

/**
 * Application shell — responsive layout foundation.
 *
 * Desktop: fixed sidebar (collapsible) + main content area.
 * Mobile: off-canvas sidebar + topbar menu trigger.
 *
 * Receives the authenticated user's permissions (resolved server-side) and
 * provides them to client components for UI-level authorization.
 */
export function AppShell({
  children,
  permissions,
  user,
  organizationName,
  unreadNotifications,
}: {
  children: ReactNode;
  permissions: string[];
  user: { name: string; email: string };
  organizationName: string;
  unreadNotifications?: number;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <PermissionProvider permissions={permissions}>
      <div className="min-h-screen min-w-0 bg-background">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
          user={user}
          organizationName={organizationName}
        />
        <div
          className={cn(
            "min-w-0 transition-[padding] duration-base ease-out",
            collapsed ? "lg:pl-16" : "lg:pl-64",
          )}
        >
          <Topbar
            onMenuClick={() => setSidebarOpen(true)}
            navigationOpen={sidebarOpen}
            user={user}
            unreadNotifications={unreadNotifications}
          />
          <main className="mx-auto min-w-0 max-w-7xl px-3 py-5 sm:px-4 sm:py-6 lg:px-8 lg:py-8">
            <div className="page-enter">{children}</div>
          </main>
        </div>
      </div>
    </PermissionProvider>
  );
}
