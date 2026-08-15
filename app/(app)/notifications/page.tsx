import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { PageHeader, Badge, Card, CardContent } from "@/components/ui";
import { NotificationService } from "@/server/services/notifications";
import { notificationTypeLabel } from "@/lib/operations/presentation";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await requireSession();
  const service = new NotificationService(session.organizationId);
  const { rows } = await service.list(session.userId, {
    page: 1,
    pageSize: 100,
    offset: 0,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Your in-app notifications and important updates."
      />

      <Card>
        <CardContent className="pt-6">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No notifications yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((n) => {
                const href =
                  n.relatedEntityType && n.relatedEntityId
                    ? `/${n.relatedEntityType}s/${n.relatedEntityId}`
                    : null;
                const inner = (
                  <div className="flex gap-3 py-3">
                    <Badge variant={n.isRead ? "neutral" : "info"}>
                      {notificationTypeLabel(n.type)}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{n.title}</p>
                      {n.message && (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {n.message}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-faint">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id} className={n.isRead ? "opacity-70" : ""}>
                    {href ? (
                      <Link href={href} className="block hover:bg-surface-subtle">
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
