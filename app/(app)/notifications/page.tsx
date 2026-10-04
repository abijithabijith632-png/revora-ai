import { requireSession } from "@/lib/auth";
import { PageHeader, Card, CardContent } from "@/components/ui";
import { NotificationService } from "@/server/services/notifications";
import { NotificationList } from "@/components/operations";

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
              No notifications yet. Assignments, due tasks, upcoming meetings,
              and deal updates will appear here.
            </p>
          ) : (
            <NotificationList
              initial={rows.map((n) => ({
                id: n.id,
                type: n.type,
                title: n.title,
                message: n.message,
                isRead: n.isRead,
                relatedEntityType: n.relatedEntityType,
                relatedEntityId: n.relatedEntityId,
                createdAt: n.createdAt.toISOString(),
              }))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
