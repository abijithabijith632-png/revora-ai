-- Phase 14: Proposals + Email + Templates + Documents

-- 1. Extend proposal status enum.
ALTER TYPE "public"."proposal_status" ADD VALUE 'expired';
ALTER TYPE "public"."proposal_status" ADD VALUE 'cancelled';

-- 2. Proposals: client/owner, expiry, cancelled, view count, notes.
ALTER TABLE "proposals" ADD COLUMN "client_id" uuid;
ALTER TABLE "proposals" ADD COLUMN "owner_id" uuid;
ALTER TABLE "proposals" ADD COLUMN "expiry_date" timestamp with time zone;
ALTER TABLE "proposals" ADD COLUMN "cancelled_at" timestamp with time zone;
ALTER TABLE "proposals" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "proposals" ADD COLUMN "notes" text;
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_client_id_clients_id_fk"
  FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE set null;
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_owner_id_users_id_fk"
  FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE set null;
CREATE INDEX "proposals_org_client_idx" ON "proposals" ("organization_id", "client_id");

-- 3. Proposal lifecycle events.
CREATE TABLE "proposal_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "from_status" "proposal_status",
  "to_status" "proposal_status" NOT NULL,
  "changed_by" uuid,
  "notes" text,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "proposal_events_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE restrict,
  CONSTRAINT "proposal_events_proposal_id_proposals_id_fk"
    FOREIGN KEY ("proposal_id") REFERENCES "proposals" ("id") ON DELETE cascade,
  CONSTRAINT "proposal_events_changed_by_users_id_fk"
    FOREIGN KEY ("changed_by") REFERENCES "users" ("id") ON DELETE set null
);
CREATE INDEX "proposal_events_proposal_idx" ON "proposal_events" ("proposal_id");
CREATE INDEX "proposal_events_org_occurred_idx" ON "proposal_events" ("organization_id", "occurred_at");

-- 4. Communications: two-way email model + tracking readiness.
ALTER TABLE "communications" ADD COLUMN "message_id" varchar(512);
ALTER TABLE "communications" ADD COLUMN "thread_id" varchar(512);
ALTER TABLE "communications" ADD COLUMN "direction" varchar(16) DEFAULT 'outbound' NOT NULL;
ALTER TABLE "communications" ADD COLUMN "recipients" jsonb;
ALTER TABLE "communications" ADD COLUMN "attachments" jsonb;
ALTER TABLE "communications" ADD COLUMN "opened_at" timestamp with time zone;
ALTER TABLE "communications" ADD COLUMN "clicked_at" timestamp with time zone;
CREATE INDEX "communications_message_idx" ON "communications" ("organization_id", "message_id");

-- 5. Email tracking events (real events only).
CREATE TABLE "email_tracking_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "communication_id" uuid NOT NULL,
  "event_type" varchar(32) NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb,
  CONSTRAINT "email_tracking_events_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE restrict,
  CONSTRAINT "email_tracking_events_communication_id_communications_id_fk"
    FOREIGN KEY ("communication_id") REFERENCES "communications" ("id") ON DELETE cascade
);
CREATE INDEX "email_tracking_comm_idx" ON "email_tracking_events" ("organization_id", "communication_id");

-- 6. Email templates (org-scoped).
CREATE TABLE "email_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "category" varchar(64) NOT NULL,
  "name" varchar(255) NOT NULL,
  "subject" varchar(255) NOT NULL,
  "body" text NOT NULL,
  "variables" jsonb,
  "is_archived" boolean DEFAULT false NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "email_templates_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE restrict,
  CONSTRAINT "email_templates_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE set null
);
CREATE INDEX "email_templates_org_category_idx" ON "email_templates" ("organization_id", "category");
CREATE INDEX "email_templates_org_created_idx" ON "email_templates" ("organization_id", "created_at");

-- 7. Documents: versioning, status, access governance.
ALTER TABLE "documents" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;
ALTER TABLE "documents" ADD COLUMN "status" varchar(32) DEFAULT 'active' NOT NULL;
ALTER TABLE "documents" ADD COLUMN "access_permissions" jsonb;
CREATE INDEX "documents_org_status_idx" ON "documents" ("organization_id", "status");
