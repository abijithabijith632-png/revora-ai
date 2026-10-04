"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Badge, Button, Select } from "@/components/ui";
import { notificationTypeLabel } from "@/lib/operations/presentation";

export interface NotificationListItem {
  id: string;
  type: string;
  title: string;
  message: string | null;
  isRead: boolean;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
}

function entityHref(n: NotificationListItem): string | null {
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
 * Full notifications list with type + read-state filtering, mark-as-read,
 * mark-all-as-read, dismiss, and links that open the related record.
 */
export function NotificationList({
  initial,
}: {
  initial: NotificationListItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [typeFilter, setTypeFilter] = useState("");
  const [readFilter, setReadFilter] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const types = useMemo(
    () => Array.from(new Set(initial.map((n) => n.type))).sort(),
    [initial],
  );

  const visible = items.filter(
    (n) =>
      (!typeFilter || n.type === typeFilter) &&
      (!readFilter ||
        (readFilter === "unread" ? !n.isRead : n.isRead)),
  );

  async function markRead(id: string) {
    if (busyId) return;
    const target = items.find((n) => n.id === id);
    if (!target || target.isRead) return;
    setBusyId(id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error();
      router.refresh();
    } catch {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: false } : n)));
    } finally {
      setBusyId(null);
    }
  }

  async function dismiss(id: string) {
    if (busyId) return;
    const previous = items;
    setBusyId(id);
    setItems((prev) => prev.filter((n) => n.id !== id));
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error();
      router.refresh();
    } catch {
      setItems(previous);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-full sm:w-56"
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {notificationTypeLabel(t)}
            </option>
          ))}
        </Select>
        <Select
          value={readFilter}
          onChange={(e) => setReadFilter(e.target.value)}
          className="w-full sm:w-44"
          aria-label="Filter by read state"
        >
          <option value="">All + unread</option>
          <option value="unread">Unread only</option>
          <option value="read">Read only</option>
        </Select>
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No notifications match these filters.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((n) => {
            const href = entityHref(n);
            return (
              <li
                key={n.id}
                className={`flex items-start gap-3 py-3 ${n.isRead ? "opacity-70" : ""}`}
              >
                <Badge variant={n.isRead ? "neutral" : "info"}>
                  {notificationTypeLabel(n.type)}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  {n.message && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                  )}
                  <p className="mt-1 text-xs text-faint" suppressHydrationWarning>
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                  {href && (
                    <Link
                      href={href}
                      onClick={() => markRead(n.id)}
                      className="mt-1 inline-block text-sm font-medium text-brand-600 hover:underline"
                    >
                      Open related record
                    </Link>
                  )}
                </div>
                <div className="flex gap-1">
                  {!n.isRead && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Mark as read"
                      disabled={busyId === n.id}
                      onClick={() => markRead(n.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Dismiss notification"
                    disabled={busyId === n.id}
                    onClick={() => dismiss(n.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
