import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getUserPermissions } from "@/lib/permissions/authorize";
import { AppShell } from "@/components/layout";
import { NotificationService } from "@/server/services/notifications";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Application layout — protects all authenticated business routes and
 * resolves the user's permissions + organization context server-side.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  const [permissions, org, unreadNotifications] = await Promise.all([
    getUserPermissions(session.userId, session.organizationId),
    db.query.organizations.findFirst({
      where: eq(organizations.id, session.organizationId),
    }),
    new NotificationService(session.organizationId)
      .unreadCount(session.userId)
      .catch(() => 0),
  ]);

  return (
    <AppShell
      permissions={[...permissions]}
      user={{ name: session.fullName, email: session.email }}
      organizationName={org?.name ?? "Organization"}
      unreadNotifications={unreadNotifications}
    >
      {children}
    </AppShell>
  );
}
