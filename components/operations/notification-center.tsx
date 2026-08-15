"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check, CheckCheck } from "lucide-react";
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
    task: "/tasks",
    meeting: "/meetings",
  };
  const prefix = base[t];
  return prefix ? `${prefix}/${id}` : null;
}

/**
 * Premium notification center — unread badge, grouped list, mark-as-read and
 * mark-all-as-read. Fetches real notification rows from the API.
 */
export function NotificationCenter({ initialCount }: { initialCount: number }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(initialCount);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?pageSize=50");
      const json = await res.json();
      if (json.success) setNotifications(json.data);
    } catch {
      /* keep previous */
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnread((u) => Math.max(0, u - 1));
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
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
                <Button variant="ghost" size="sm" onClick={markAllRead}>
                  <CheckCheck className="h-4 w-4" />
                  Mark all read
                </Button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
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
                          <p className="mt-1 text-[11px] text-faint">
                            {new Date(n.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {!n.isRead && (
                          <button
                            type="button"
                            aria-label="Mark as read"
                            onClick={() => markRead(n.id)}
                            className="self-start text-faint hover:text-foreground"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
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
