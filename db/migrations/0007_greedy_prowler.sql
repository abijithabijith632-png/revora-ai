-- Phase 13: Activities + Follow-ups + Tasks + Meetings + Notifications

-- 1. Extend the notification type enum (Track A types).
ALTER TYPE "public"."notification_type" ADD VALUE 'important_deal_update';
ALTER TYPE "public"."notification_type" ADD VALUE 'assignment';

-- 2. Follow-ups: explicit action description (Track A field).
ALTER TABLE "followups" ADD COLUMN "action_description" text;

-- 3. Meetings: action items + optional lead link.
ALTER TABLE "meetings" ADD COLUMN "action_items" jsonb;
ALTER TABLE "meetings" ADD COLUMN "lead_id" uuid;
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_lead_id_leads_id_fk"
  FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE cascade;
CREATE INDEX "meetings_org_lead_idx" ON "meetings" ("organization_id", "lead_id");

-- 4. Per-user notification preferences (tenant-scoped).
CREATE TABLE "user_notification_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "email_enabled" boolean DEFAULT true NOT NULL,
  "in_app_enabled" boolean DEFAULT true NOT NULL,
  "types" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_notification_preferences_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE restrict,
  CONSTRAINT "user_notification_preferences_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE cascade
);

CREATE UNIQUE INDEX "user_notification_preferences_user_idx"
  ON "user_notification_preferences" ("organization_id", "user_id");
