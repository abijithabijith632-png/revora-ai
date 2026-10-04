"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check, CheckCheck, X } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { notificationTypeLabel } from "@/lib/operations/presentation";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  isRead: boolean;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
}

function entityHref(n: Notification): string | null {
  const { relatedEntityType: t, relatedEntityId: id } = n;
  if (!t || !id) return null;
  const base: Record<string, string> = {
    lead: "/leads",
    client: "/clients",
    opportunity: "/opportunities",
    proposal: "/proposals",
    task: "/tasks",
    meeting: "/meetings",
  };
  const prefix = base[t];
  return prefix ? `${prefix}/${id}` : null;
}

/**
 * Premium notification center — unread badge, grouped list, mark-as-read,
 * mark-all-as-read, and dismiss. Fetches real notification rows from the API
 * with loading/error states and rollback on failure.
 */
export function NotificationCenter({ initialCount }: { initialCount: number }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(initialCount);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/notifications?pageSize=50");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Could not load notifications.");
      }
      setNotifications(Array.isArray(json.data) ? json.data : []);
      const countRes = await fetch("/api/notifications/unread-count");
      const countJson = await countRes.json().catch(() => null);
      if (countRes.ok && countJson?.success && typeof countJson.data?.count === "number") {
        setUnread(countJson.data.count);
      } else if (countRes.ok && countJson?.success && typeof countJson.data === "number") {
        setUnread(countJson.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function markRead(id: string) {
    const previous = notifications;
    const target = previous.find((n) => n.id === id);
    if (!target || target.isRead || busyId) return;
    setBusyId(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnread((u) => Math.max(0, u - 1));
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? "Could not mark as read.");
      }
    } catch {
      setNotifications(previous);
      setUnread((u) => u + 1);
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    if (busyAll) return;
    const previous = notifications;
    const previousUnread = unread;
    setBusyAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
    try {
      const res = await fetch("/api/notifications/read-all", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? "Could not mark all as read.");
      }
    } catch {
      setNotifications(previous);
      setUnread(previousUnread);
    } finally {
      setBusyAll(false);
    }
  }

  async function dismiss(id: string) {
    if (busyId) return;
    const previous = notifications;
    const target = previous.find((n) => n.id === id);
    setBusyId(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (target && !target.isRead) setUnread((u) => Math.max(0, u - 1));
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? "Could not dismiss.");
      }
    } catch {
      setNotifications(previous);
      if (target && !target.isRead) setUnread((u) => u + 1);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Notifications (${unread} unread)`}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-40 mt-2 w-80 rounded-lg border border-border bg-surface shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-foreground">
                Notifications
              </span>
              {unread > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllRead}
                  disabled={busyAll}
                >
                  <CheckCheck className="h-4 w-4" />
                  {busyAll ? "Marking…" : "Mark all read"}
                </Button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <p role="status" className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Loading notifications…
                </p>
              ) : error ? (
                <div className="space-y-2 px-4 py-8 text-center">
                  <p role="alert" className="text-sm text-danger">
                    {error}
                  </p>
                  <Button variant="outline" size="sm" onClick={load}>
                    Retry
                  </Button>
                </div>
              ) : notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No notifications yet.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {notifications.map((n) => {
                    const href = entityHref(n);
                    const content = (
                      <div className="flex gap-2 px-4 py-3">
                        <Badge variant={n.isRead ? "neutral" : "info"}>
                          {notificationTypeLabel(n.type)}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {n.title}
                          </p>
                          {n.message && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {n.message}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-faint" suppressHydrationWarning>
                            {new Date(n.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 self-start">
                          {!n.isRead && (
                            <button
                              type="button"
                              aria-label="Mark as read"
                              disabled={busyId === n.id}
                              onClick={() => markRead(n.id)}
                              className="text-faint hover:text-foreground disabled:opacity-50"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label="Dismiss notification"
                            disabled={busyId === n.id}
                            onClick={() => dismiss(n.id)}
                            className="text-faint hover:text-foreground disabled:opacity-50"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                    return (
                      <li key={n.id} className="hover:bg-surface-subtle">
                        {href ? (
                          <Link href={href} onClick={() => markRead(n.id)}>
                            {content}
                          </Link>
                        ) : (
                          content
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
