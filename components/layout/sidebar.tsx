"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, PanelLeftClose, PanelLeftOpen, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS } from "./nav";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { Tooltip } from "@/components/ui/tooltip";
import { usePermission } from "@/components/auth/can";

/**
 * Premium enterprise sidebar:
 * - permission-aware navigation (filters items by user permissions)
 * - collapsed state (icon-only with tooltips)
 * - organization context + user/profile area
 * - responsive off-canvas on mobile
 */
export function Sidebar({
  open,
  onClose,
  collapsed,
  onToggleCollapsed,
  user,
  organizationName,
}: {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  user: { name: string; email: string };
  organizationName: string;
}) {
  const pathname = usePathname();
  const can = usePermission();

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => can(item.permission)),
  })).filter((section) => section.items.length > 0);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-surface",
          "transition-[width,transform] duration-base ease-out",
          collapsed ? "lg:w-16" : "lg:w-64",
          "w-64",
          "lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            "flex h-16 items-center border-b border-border px-5",
            collapsed ? "lg:justify-center lg:px-0" : "justify-between",
          )}
        >
          <Link href="/dashboard" className="flex items-center gap-2">
            <Logo showWordmark={!collapsed} />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Organization context */}
        <div className={cn("border-b border-border px-3 py-3", collapsed && "lg:px-2")}>
          {collapsed ? (
            <div className="lg:flex lg:justify-center">
              <Tooltip content={organizationName} side="right">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-subtle text-xs font-semibold text-foreground"
                  aria-label="Organization context"
                >
                  {organizationName.charAt(0).toUpperCase()}
                </button>
              </Tooltip>
            </div>
          ) : (
            <div className="flex w-full items-center gap-2 rounded-md px-2 py-1.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
                {organizationName.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {organizationName}
                </span>
                <span className="block truncate text-xs text-faint">
                  {user.email}
                </span>
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 text-faint" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section.label} className="mb-4">
              {!collapsed && (
                <p className="px-3 pb-1.5 text-xs font-medium uppercase tracking-wider text-faint">
                  {section.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = pathname.startsWith(item.href);
                  const Icon = item.icon;

                  const link = (
                    <Link
                      href={item.href}
                      aria-label={item.label}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                        "transition-colors duration-fast",
                        collapsed && "lg:justify-center lg:px-0",
                        active
                          ? "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                          : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  );

                  return (
                    <li key={item.href}>
                      {collapsed ? (
                        <Tooltip content={item.label} side="right">
                          {link}
                        </Tooltip>
                      ) : (
                        link
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User / profile area */}
        <div className="border-t border-border p-3">
          {collapsed ? (
            <div className="lg:flex lg:justify-center">
              <Tooltip content={user.name} side="right">
                <button type="button" className="flex" aria-label="User profile">
                  <Avatar name={user.name} status="online" size="sm" />
                </button>
              </Tooltip>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-1">
              <Avatar name={user.name} status="online" size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                <p className="truncate text-xs text-faint">{user.email}</p>
              </div>
            </div>
          )}
        </div>

        {/* Collapse toggle (desktop) */}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="hidden h-10 items-center justify-center border-t border-border text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground lg:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </aside>
    </>
  );
}
