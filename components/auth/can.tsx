"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Permission } from "@/lib/permissions";

/**
 * UI authorization helper.
 *
 * IMPORTANT: UI hiding is NOT security. Server-side `requirePermission`
 * remains mandatory. This context only controls button/nav visibility.
 */

const PermissionContext = createContext<Set<string>>(new Set());

export function PermissionProvider({
  permissions,
  children,
}: {
  permissions: string[];
  children: ReactNode;
}) {
  return (
    <PermissionContext.Provider value={new Set(permissions)}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermission(): (p: Permission) => boolean {
  const perms = useContext(PermissionContext);
  return (p) => perms.has(p);
}

export function Can({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const can = usePermission();
  return can(permission) ? <>{children}</> : null;
}
