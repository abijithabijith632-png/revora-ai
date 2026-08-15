import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  boolean,
  index,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";
import { leads, clients, contacts } from "./sales";
import { opportunities } from "./opportunities";
import {
  taskStatusEnum,
  taskPriorityEnum,
  followupStatusEnum,
  followupChannelEnum,
  meetingStatusEnum,
  meetingParticipantTypeEnum,
  proposalStatusEnum,
  activityTypeEnum,
  communicationTypeEnum,
  communicationStatusEnum,
  notificationTypeEnum,
  documentTypeEnum,
} from "./enums";
import { createdAt, updatedAt } from "./common";

/**
 * Operations domain — activities, tasks, follow-ups, meetings, proposals,
 * communications, documents, and notifications.
 */

/* -------------------------------------------------------------
 * Activities (polymorphic links to lead/client/contact/opportunity/user)
 * ------------------------------------------------------------ */
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    type: activityTypeEnum("type").notNull(),
    subject: varchar("subject", { length: 255 }),
    notes: text("notes"),
    metadata: jsonb("metadata"),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "cascade",
    }),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id, {
      onDelete: "cascade",
    }),
    performedBy: uuid("performed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("activities_org_lead_idx").on(table.organizationId, table.leadId),
    index("activities_org_client_idx").on(table.organizationId, table.clientId),
    index("activities_org_opp_idx").on(table.organizationId, table.opportunityId),
    index("activities_org_occurred_idx").on(table.organizationId, table.occurredAt),
  ],
);

/* -------------------------------------------------------------
 * Tasks
 * ------------------------------------------------------------ */
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    assignedTo: uuid("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    priority: taskPriorityEnum("priority").default("medium").notNull(),
    status: taskStatusEnum("status").default("pending").notNull(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id, {
      onDelete: "cascade",
    }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("tasks_org_assignee_idx").on(table.organizationId, table.assignedTo),
    index("tasks_org_due_idx").on(table.organizationId, table.dueDate),
    index("tasks_org_status_idx").on(table.organizationId, table.status),
  ],
);

/* -------------------------------------------------------------
 * Follow-ups
 * ------------------------------------------------------------ */
export const followups = pgTable(
  "followups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "cascade",
    }),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id, {
      onDelete: "cascade",
    }),
    assignedTo: uuid("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    channel: followupChannelEnum("channel").default("email").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    priority: taskPriorityEnum("priority").default("medium").notNull(),
    status: followupStatusEnum("status").default("pending").notNull(),
    actionDescription: text("action_description"),
    notes: text("notes"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("followups_org_scheduled_idx").on(table.organizationId, table.scheduledAt),
    index("followups_org_assignee_idx").on(table.organizationId, table.assignedTo),
    index("followups_org_status_idx").on(table.organizationId, table.status),
  ],
);

/* -------------------------------------------------------------
 * Meetings
 * ------------------------------------------------------------ */
export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes"),
    organizerId: uuid("organizer_id").references(() => users.id, {
      onDelete: "set null",
    }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    virtualLink: varchar("virtual_link", { length: 255 }),
    status: meetingStatusEnum("status").default("scheduled").notNull(),
    agenda: text("agenda"),
    notes: text("notes"),
    outcome: text("outcome"),
    actionItems: jsonb("action_items"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("meetings_org_scheduled_idx").on(table.organizationId, table.scheduledAt),
    index("meetings_org_organizer_idx").on(table.organizationId, table.organizerId),
    index("meetings_org_lead_idx").on(table.organizationId, table.leadId),
  ],
);

/* -------------------------------------------------------------
 * Meeting participants (internal users + external contacts)
 * ------------------------------------------------------------ */
export const meetingParticipants = pgTable(
  "meeting_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "cascade",
    }),
    participantType: meetingParticipantTypeEnum("participant_type")
      .default("internal")
      .notNull(),
  },
  (table) => [
    index("meeting_participants_meeting_idx").on(table.meetingId),
    index("meeting_participants_user_idx").on(table.userId),
    index("meeting_participants_contact_idx").on(table.contactId),
  ],
);

/* -------------------------------------------------------------
 * Proposals
 * ------------------------------------------------------------ */
export const proposals = pgTable(
  "proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "restrict" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    title: varchar("title", { length: 255 }).notNull(),
    amount: integer("amount"),
    version: integer("version").default(1).notNull(),
    status: proposalStatusEnum("status").default("draft").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    expiryDate: timestamp("expiry_date", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    viewCount: integer("view_count").default(0).notNull(),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("proposals_org_opp_idx").on(table.organizationId, table.opportunityId),
    index("proposals_org_status_idx").on(table.organizationId, table.status),
    index("proposals_org_client_idx").on(table.organizationId, table.clientId),
  ],
);

/* -------------------------------------------------------------
 * Proposal lifecycle events (audit trail of status transitions)
 * ------------------------------------------------------------ */
export const proposalEvents = pgTable(
  "proposal_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    fromStatus: proposalStatusEnum("from_status"),
    toStatus: proposalStatusEnum("to_status").notNull(),
    changedBy: uuid("changed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("proposal_events_proposal_idx").on(table.proposalId),
    index("proposal_events_org_occurred_idx").on(table.organizationId, table.occurredAt),
  ],
);

/* -------------------------------------------------------------
 * Communications (internal records; no external integration)
 * ------------------------------------------------------------ */
export const communications = pgTable(
  "communications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    senderId: uuid("sender_id").references(() => users.id, {
      onDelete: "set null",
    }),
    recipient: varchar("recipient", { length: 320 }),
    subject: varchar("subject", { length: 255 }),
    body: text("body"),
    type: communicationTypeEnum("type").default("email").notNull(),
    status: communicationStatusEnum("status").default("sent").notNull(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "cascade",
    }),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id, {
      onDelete: "cascade",
    }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    // Phase 14: two-way email model + tracking readiness.
    messageId: varchar("message_id", { length: 512 }),
    threadId: varchar("thread_id", { length: 512 }),
    direction: varchar("direction", { length: 16 }).default("outbound").notNull(),
    recipients: jsonb("recipients"),
    attachments: jsonb("attachments"),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
    metadata: jsonb("metadata"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("communications_org_sent_idx").on(table.organizationId, table.sentAt),
    index("communications_org_lead_idx").on(table.organizationId, table.leadId),
    index("communications_org_contact_idx").on(table.organizationId, table.contactId),
    index("communications_message_idx").on(table.organizationId, table.messageId),
  ],
);

/* -------------------------------------------------------------
 * Email tracking events (real events only — never fabricated)
 * ------------------------------------------------------------ */
export const emailTrackingEvents = pgTable(
  "email_tracking_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    communicationId: uuid("communication_id")
      .notNull()
      .references(() => communications.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 32 }).notNull(), // open | click
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    metadata: jsonb("metadata"),
  },
  (table) => [
    index("email_tracking_comm_idx").on(table.organizationId, table.communicationId),
  ],
);

/* -------------------------------------------------------------
 * Email templates (org-scoped reusable templates)
 * ------------------------------------------------------------ */
export const emailTemplates = pgTable(
  "email_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    category: varchar("category", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    body: text("body").notNull(),
    variables: jsonb("variables"),
    isArchived: boolean("is_archived").default(false).notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("email_templates_org_category_idx").on(table.organizationId, table.category),
    index("email_templates_org_created_idx").on(table.organizationId, table.createdAt),
  ],
);

/* -------------------------------------------------------------
 * Documents (metadata only — no filesystem access)
 * ------------------------------------------------------------ */
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 255 }).notNull(),
    documentType: documentTypeEnum("document_type").default("other").notNull(),
    fileReference: varchar("file_reference", { length: 512 }),
    sizeBytes: integer("size_bytes"),
    mimeType: varchar("mime_type", { length: 128 }),
    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id, {
      onDelete: "cascade",
    }),
    // Phase 14: versioning, status, access governance.
    version: integer("version").default(1).notNull(),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    accessPermissions: jsonb("access_permissions"),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("documents_org_created_idx").on(table.organizationId, table.createdAt),
    index("documents_org_client_idx").on(table.organizationId, table.clientId),
    index("documents_org_status_idx").on(table.organizationId, table.status),
  ],
);

/* -------------------------------------------------------------
 * Notifications
 * ------------------------------------------------------------ */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message"),
    isRead: boolean("is_read").default(false).notNull(),
    relatedEntityType: varchar("related_entity_type", { length: 32 }),
    relatedEntityId: uuid("related_entity_id"),
    createdAt,
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [
    index("notifications_user_read_idx").on(
      table.organizationId,
      table.userId,
      table.isRead,
    ),
    index("notifications_created_idx").on(table.organizationId, table.createdAt),
  ],
);

/* -------------------------------------------------------------
 * User notification preferences (per-user, tenant-scoped)
 * ------------------------------------------------------------ */
export const userNotificationPreferences = pgTable(
  "user_notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emailEnabled: boolean("email_enabled").default(true).notNull(),
    inAppEnabled: boolean("in_app_enabled").default(true).notNull(),
    /** Per-type enable/disable map, e.g. { "task_due": false }. */
    types: jsonb("types"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("user_notification_preferences_user_idx").on(
      table.organizationId,
      table.userId,
    ),
  ],
);

export type Task = typeof tasks.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Meeting = typeof meetings.$inferSelect;
export type Proposal = typeof proposals.$inferSelect;
export type ProposalEvent = typeof proposalEvents.$inferSelect;
export type Communication = typeof communications.$inferSelect;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type UserNotificationPreference = typeof userNotificationPreferences.$inferSelect;
