"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, FormField, Input, Select, Badge, Avatar } from "@/components/ui";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";

export interface ManagedUser {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
  department: string | null;
  designation: string | null;
  status: string;
  roles: Array<{ id: string; name: string }>;
}

export interface RoleOption {
  id: string;
  name: string;
}

async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error?.message ?? `Request failed (${res.status}).`);
  }
  return json.data as T;
}

/**
 * Organization user management: search, invite, edit, role assignment,
 * activation/deactivation, and removal. All operations go through the
 * existing validated admin APIs with server-side authorization.
 */
export function UserManager({
  initialUsers,
  roles,
  initialSearch,
}: {
  initialUsers: ManagedUser[];
  roles: RoleOption[];
  initialSearch: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState(initialSearch);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState(roles[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    fullName: "",
    jobTitle: "",
    department: "",
    designation: "",
  });

  function startEdit(u: ManagedUser) {
    setEditingId(u.id);
    setEditValues({
      fullName: u.fullName,
      jobTitle: u.jobTitle ?? "",
      department: u.department ?? "",
      designation: u.designation ?? "",
    });
  }

  async function submitSearch() {
    const params = new URLSearchParams(searchParams.toString());
    if (search.trim()) params.set("search", search.trim());
    else params.delete("search");
    params.delete("page");
    router.push(`?${params.toString()}`);
    router.refresh();
  }

  async function invite() {
    if (busy) return;
    setBusy(true);
    try {
      if (!inviteEmail.trim()) throw new Error("Enter an email address.");
      await api("/api/users", "POST", {
        email: inviteEmail.trim(),
        roleId: inviteRole || undefined,
      });
      toast({ variant: "success", title: "Invitation sent." });
      setInviteOpen(false);
      setInviteEmail("");
      router.refresh();
    } catch (e) {
      toast({
        variant: "error",
        title: "Could not invite user",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await api<ManagedUser>(`/api/users/${id}`, "PATCH", {
        fullName: editValues.fullName.trim() || undefined,
        jobTitle: editValues.jobTitle.trim() || null,
        department: editValues.department.trim() || null,
        designation: editValues.designation.trim() || null,
      });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
      setEditingId(null);
      toast({ variant: "success", title: "User updated." });
      router.refresh();
    } catch (e) {
      toast({
        variant: "error",
        title: "Could not update user",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(id: string, roleId: string) {
    if (!roleId || busy) return;
    setBusy(true);
    try {
      await api(`/api/rbac/users/${id}/role`, "PATCH", { roleId });
      const role = roles.find((r) => r.id === roleId);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === id && role ? { ...u, roles: [{ id: role.id, name: role.name }] } : u,
        ),
      );
      toast({ variant: "success", title: "Role assigned." });
      router.refresh();
    } catch (e) {
      toast({
        variant: "error",
        title: "Could not assign role",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(id: string, status: string) {
    if (!status || busy) return;
    setBusy(true);
    try {
      const updated = await api<{ status: string }>(`/api/users/${id}/status`, "PATCH", {
        status,
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, status: updated.status } : u)),
      );
      toast({ variant: "success", title: "Status updated." });
      router.refresh();
    } catch (e) {
      toast({
        variant: "error",
        title: "Could not update status",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, name: string) {
    if (busy) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Remove ${name} from the organization? They will lose access immediately.`)
    ) {
      return;
    }
    setBusy(true);
    try {
      await api(`/api/users/${id}`, "DELETE");
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast({ variant: "success", title: "User removed." });
      router.refresh();
    } catch (e) {
      toast({
        variant: "error",
        title: "Could not remove user",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submitSearch();
          }}
        >
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            aria-label="Search users"
            className="flex-1"
          />
          <Button type="submit" size="sm" variant="outline">
            Search
          </Button>
        </form>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          + Invite User
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Department</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Avatar name={u.fullName} size="sm" />
                    <div>
                      <p className="font-medium text-foreground">{u.fullName}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  {editingId === u.id && (
                    <div className="mt-2 grid max-w-md gap-2">
                      <Input
                        aria-label="Full name"
                        value={editValues.fullName}
                        onChange={(e) =>
                          setEditValues({ ...editValues, fullName: e.target.value })
                        }
                        placeholder="Full name"
                      />
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <Input
                          aria-label="Job title"
                          value={editValues.jobTitle}
                          onChange={(e) =>
                            setEditValues({ ...editValues, jobTitle: e.target.value })
                          }
                          placeholder="Job title"
                        />
                        <Input
                          aria-label="Department"
                          value={editValues.department}
                          onChange={(e) =>
                            setEditValues({ ...editValues, department: e.target.value })
                          }
                          placeholder="Department"
                        />
                        <Input
                          aria-label="Designation"
                          value={editValues.designation}
                          onChange={(e) =>
                            setEditValues({ ...editValues, designation: e.target.value })
                          }
                          placeholder="Designation"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          loading={busy}
                          disabled={busy}
                          onClick={() => saveEdit(u.id)}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">{u.department ?? "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1">
                    {u.roles.map((r) => (
                      <Badge key={r.id} variant="ai">
                        {r.name}
                      </Badge>
                    ))}
                  </div>
                  <Select
                    aria-label={`Change role for ${u.fullName}`}
                    value=""
                    onChange={(e) => {
                      if (e.target.value) void changeRole(u.id, e.target.value);
                      e.target.value = "";
                    }}
                    className="mt-1 w-40"
                  >
                    <option value="">Change role…</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Select
                    aria-label={`Change status for ${u.fullName}`}
                    value={u.status}
                    onChange={(e) => void changeStatus(u.id, e.target.value)}
                    className="w-32"
                  >
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                    <option value="suspended">suspended</option>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        editingId === u.id ? setEditingId(null) : startEdit(u)
                      }
                    >
                      {editingId === u.id ? "Close" : "Edit"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={() => remove(u.id, u.fullName)}
                    >
                      Remove
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No users found.
          </p>
        )}
      </div>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite user"
        description="Send an organization invitation by email."
        className="max-w-md"
      >
        <div className="space-y-4">
          <FormField label="Email" htmlFor="invite-email">
            <Input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@company.com"
            />
          </FormField>
          <FormField label="Role" htmlFor="invite-role">
            <Select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button loading={busy} disabled={busy} onClick={invite}>
              Send invite
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
