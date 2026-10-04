"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
} from "@/components/ui";
import { Modal } from "@/components/ui/overlay";

export interface RoleDetail {
  id: string;
  name: string;
  isSystem: boolean;
  userCount: number;
  permissionCount: number;
  permissions: string[];
}

export interface RoleUser {
  id: string;
  fullName: string;
  email: string;
  roles: Array<{ id: string; name: string }>;
}

/**
 * Role cards that open a detail view (assigned users + permissions) on
 * click, without changing role authorization behavior.
 */
export function RoleCards({
  roles,
  users,
}: {
  roles: RoleDetail[];
  users: RoleUser[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = roles.find((r) => r.id === selectedId) ?? null;
  const assigned = selected
    ? users.filter((u) => u.roles.some((r) => r.id === selected.id))
    : [];

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {roles.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => setSelectedId(role.id)}
            className="text-left"
            aria-label={`View ${role.name} role details`}
          >
            <Card interactive className="h-full">
              <CardHeader>
                <CardTitle>{role.name}</CardTitle>
                <CardDescription>
                  {role.userCount} user{role.userCount === 1 ? "" : "s"} ·{" "}
                  {role.permissionCount} permissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant={role.isSystem ? "info" : "default"}>
                  {role.isSystem ? "System role" : "Custom role"}
                </Badge>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <Modal
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        title={selected ? `${selected.name} — role details` : "Role details"}
        description={
          selected
            ? `${selected.userCount} assigned user${selected.userCount === 1 ? "" : "s"} · ${selected.permissionCount} permissions`
            : undefined
        }
        className="max-w-lg"
      >
        {selected && (
          <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Assigned users ({assigned.length})
              </p>
              {assigned.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  No users assigned to this role.
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {assigned.map((u) => (
                    <li key={u.id} className="text-sm">
                      <span className="font-medium text-foreground">
                        {u.fullName}
                      </span>{" "}
                      <span className="text-muted-foreground">{u.email}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Permissions ({selected.permissions.length})
              </p>
              {selected.permissions.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  No permissions granted.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selected.permissions.map((p) => (
                    <Badge key={p} variant="neutral">
                      {p}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
