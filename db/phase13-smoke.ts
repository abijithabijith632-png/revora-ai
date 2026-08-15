import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "./index";
import {
  organizations,
  users,
  roles,
  userRoles,
  permissions,
  rolePermissions,
  clients,
  activities,
  tasks,
  followups,
  meetings,
  meetingParticipants,
  notifications,
  userNotificationPreferences,
  auditLogs,
} from "./schema";
import { ALL_PERMISSIONS, ROLE_PERMISSION_MATRIX } from "@/lib/permissions";
import { userHasPermission } from "@/lib/permissions/authorize";
import { ActivityService } from "@/server/services/activities";
import { TaskService } from "@/server/services/tasks";
import { FollowupService } from "@/server/services/followups";
import { MeetingService } from "@/server/services/meetings";
import { NotificationService } from "@/server/services/notifications";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAILED: ${label}`);
  console.log(`  ✓ ${label}`);
}

const SLUG = "phase13-smoke";

async function cleanup() {
  const orgs = await db
    .select()
    .from(organizations)
    .where(inArray(organizations.slug, [SLUG, `${SLUG}-other`]));
  for (const o of orgs) {
    await db.delete(auditLogs).where(eq(auditLogs.organizationId, o.id));
    await db.delete(notifications).where(eq(notifications.organizationId, o.id));
    await db.delete(userNotificationPreferences).where(eq(userNotificationPreferences.organizationId, o.id));
    await db.delete(meetingParticipants).where(
      inArray(
        meetingParticipants.meetingId,
        db.select({ id: meetings.id }).from(meetings).where(eq(meetings.organizationId, o.id)),
      ),
    );
    await db.delete(meetings).where(eq(meetings.organizationId, o.id));
    await db.delete(followups).where(eq(followups.organizationId, o.id));
    await db.delete(tasks).where(eq(tasks.organizationId, o.id));
    await db.delete(activities).where(eq(activities.organizationId, o.id));
    await db.delete(clients).where(eq(clients.organizationId, o.id));

    const u = await db.select({ id: users.id }).from(users).where(eq(users.organizationId, o.id));
    for (const row of u) {
      await db.delete(userRoles).where(eq(userRoles.userId, row.id));
      await db.delete(users).where(eq(users.id, row.id));
    }
    const r = await db.select({ id: roles.id }).from(roles).where(eq(roles.organizationId, o.id));
    for (const row of r) {
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, row.id));
      await db.delete(roles).where(eq(roles.id, row.id));
    }
    await db.delete(organizations).where(eq(organizations.id, o.id));
  }
}

async function seedRoles(orgId: string) {
  await db
    .insert(permissions)
    .values(
      ALL_PERMISSIONS.map((p) => {
        const [resource, action] = p.split(".");
        return { resource, action };
      }),
    )
    .onConflictDoNothing();
  const allPerms = await db.select().from(permissions);
  const permKey = new Map(allPerms.map((p) => [`${p.resource}.${p.action}`, p.id]));

  const roleRows = await db
    .insert(roles)
    .values([
      { organizationId: orgId, name: "Super Admin", isSystem: true },
      { organizationId: orgId, name: "Sales Executive", isSystem: true },
    ])
    .returning();

  for (const r of roleRows) {
    const perms = ROLE_PERMISSION_MATRIX[r.name as keyof typeof ROLE_PERMISSION_MATRIX];
    for (const p of perms) {
      const pid = permKey.get(p);
      if (pid) await db.insert(rolePermissions).values({ roleId: r.id, permissionId: pid });
    }
  }
  return new Map(roleRows.map((r) => [r.name, r.id]));
}

async function main() {
  console.log("[phase13-smoke] Starting Phase 13 execution layer smoke test...");
  await cleanup();

  const [org] = await db
    .insert(organizations)
    .values({ name: "Phase 13 Smoke", slug: SLUG })
    .returning();
  const byName = await seedRoles(org.id);

  const [admin, exec] = await db
    .insert(users)
    .values([
      { organizationId: org.id, email: "admin@phase13.test", fullName: "Admin", status: "active" },
      { organizationId: org.id, email: "exec@phase13.test", fullName: "Exec", status: "active" },
    ])
    .returning();

  await db.insert(userRoles).values([
    { userId: admin.id, roleId: byName.get("Super Admin")! },
    { userId: exec.id, roleId: byName.get("Sales Executive")! },
  ]);

  // RBAC least privilege
  assert(
    await userHasPermission(admin.id, org.id, "activities.create"),
    "Super Admin has activities.create",
  );
  assert(
    !(await userHasPermission(exec.id, org.id, "tasks.assign")),
    "Sales Executive lacks tasks.assign (least privilege)",
  );

  // Client for entity links
  const [client] = await db
    .insert(clients)
    .values({
      organizationId: org.id,
      companyName: "Smoke Client",
      clientNumber: "CL-SMOKE-1",
      status: "active",
    })
    .returning();

  const activityService = new ActivityService(org.id);
  const taskService = new TaskService(org.id);
  const followupService = new FollowupService(org.id);
  const meetingService = new MeetingService(org.id);
  const notificationService = new NotificationService(org.id);
  const actor = { userId: admin.id };

  // ---- Activities ----
  const activity = await activityService.create(actor, {
    type: "call",
    subject: "Intro call",
    clientId: client.id,
  });
  assert(activity.type === "call", "activity created");
  const timeline = await activityService.timeline("client", client.id);
  assert(timeline.some((a) => a.id === activity.id), "activity appears in client timeline");

  // ---- Tasks ----
  const task = await taskService.create(actor, {
    title: "Prepare proposal",
    assignedTo: admin.id,
    clientId: client.id,
    priority: "medium",
    status: "pending",
  });
  assert(task.title === "Prepare proposal", "task created");

  const completed = await taskService.complete(actor, task.id, { status: "completed" });
  assert(completed.status === "completed" && completed.completedAt != null, "task completed");

  const reassigned = await taskService.reassign(actor, task.id, { assignedTo: exec.id });
  assert(reassigned.assignedTo === exec.id, "task reassigned");

  // Reassign should have created an assignment notification
  const execNotifs = await notificationService.list(exec.id, {
    page: 1,
    pageSize: 50,
    offset: 0,
  });
  assert(
    execNotifs.rows.some((n) => n.type === "assignment" && n.title === "Task assigned to you"),
    "assignment notification emitted",
  );

  // ---- Follow-ups ----
  const followup = await followupService.create(actor, {
    clientId: client.id,
    channel: "phone",
    scheduledAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    priority: "high",
    status: "pending",
    actionDescription: "Call about overdue invoice",
  });
  assert(followup.actionDescription === "Call about overdue invoice", "followup created with action description");

  const reminders = await followupService.reminders(admin.id);
  assert(reminders.overdue.length >= 1, "overdue follow-up appears in reminders");

  await followupService.changeStatus(actor, followup.id, { status: "completed" });
  const updatedFup = await followupService.getById(followup.id);
  assert(updatedFup.status === "completed", "followup status updated");

  // ---- Meetings ----
  const meeting = await meetingService.create(actor, {
    title: "Discovery call",
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: "scheduled",
    participants: [
      { userId: admin.id, participantType: "organizer" },
    ],
  });
  assert(meeting.title === "Discovery call", "meeting created");
  assert(meeting.participants.length >= 1, "meeting participants stored");

  const reminded = await meetingService.sendReminders(meeting.id);
  assert(reminded.reminded >= 1, "meeting reminders sent to participants");

  // ---- Notifications: read/unread ----
  const unreadBefore = await notificationService.unreadCount(admin.id);
  assert(unreadBefore >= 1, "unread count reflects new notifications");

  const adminNotifs = await notificationService.list(admin.id, {
    page: 1,
    pageSize: 50,
    offset: 0,
  });
  const firstUnread = adminNotifs.rows.find((n) => !n.isRead);
  assert(!!firstUnread, "has unread notification");

  await notificationService.markRead(admin.id, firstUnread!.id);
  const unreadAfter = await notificationService.unreadCount(admin.id);
  assert(unreadAfter === unreadBefore - 1, "mark-read decrements unread count");

  await notificationService.markAllRead(admin.id);
  assert(
    (await notificationService.unreadCount(admin.id)) === 0,
    "mark-all-read clears unread count",
  );

  // Preferences: disable in-app → notify() suppressed
  await notificationService.updatePreferences(exec.id, { inAppEnabled: false });
  const suppressed = await notificationService.notify({
    userId: exec.id,
    type: "system",
    title: "Should be suppressed",
  });
  assert(suppressed === null, "notification suppressed when in-app disabled");

  // Tenant isolation
  const [orgOther] = await db
    .insert(organizations)
    .values({ name: "Other", slug: `${SLUG}-other` })
    .returning();
  const otherService = new ActivityService(orgOther.id);
  let isolated = false;
  try {
    await otherService.getById(activity.id);
  } catch (e) {
    isolated = (e as Error).message.includes("not found");
  }
  assert(isolated, "cross-tenant activity access blocked");

  await cleanup();
  console.log("[phase13-smoke] All Phase 13 execution layer smoke tests passed.");
}

main()
  .catch((err) => {
    console.error("[phase13-smoke] FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
