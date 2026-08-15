"use client";

import { Menu, Search, Command } from "lucide-react";
import { Button } from "@/components/ui";
import { ThemeToggle } from "./theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { NotificationCenter } from "@/components/operations";

/**
 * Topbar: mobile menu trigger, global search placeholder, notifications
 * center, theme toggle, and user profile.
 */
export function Topbar({
  onMenuClick,
  user,
  unreadNotifications,
}: {
  onMenuClick: () => void;
  user: { name: string; email: string };
  unreadNotifications?: number;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur-md lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <button
        type="button"
        className="hidden h-9 w-full max-w-md items-center gap-2 rounded-md border border-border bg-surface-subtle px-3 text-sm text-faint transition-colors hover:border-border-strong hover:text-muted-foreground sm:flex"
        aria-label="Search (coming soon)"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <span className="flex-1 text-left">Search leads, clients, opportunities…</span>
        <span className="flex items-center gap-1 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-faint">
          <Command className="h-3 w-3" aria-hidden="true" />K
        </span>
      </button>

      <div className="flex-1" />

      <NotificationCenter initialCount={unreadNotifications ?? 0} />

      <ThemeToggle />

      <Button variant="ghost" size="sm" className="gap-2 px-1.5" aria-label="Profile">
        <Avatar name={user.name} status="online" size="sm" />
      </Button>
    </header>
  );
}
