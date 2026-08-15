-- Phase 16 — Admin + Organization Settings + SaaS/Billing + Platform Telemetry

-- =============================================================
-- 1. Company profile fields on organizations
-- =============================================================
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "website" varchar(255);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "industry" varchar(128);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "contact_email" varchar(320);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "contact_phone" varchar(32);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "address" text;

-- =============================================================
-- 2. User administration fields
-- =============================================================
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department" varchar(128);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "designation" varchar(128);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_platform_admin" boolean DEFAULT false NOT NULL;

-- =============================================================
-- 3. Convert lead source/status to tenant-configurable varchar
--    (data-preserving; existing values remain valid)
-- =============================================================
ALTER TABLE "leads" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "leads" ALTER COLUMN "source" SET DATA TYPE varchar(64) USING "source"::text;
ALTER TABLE "leads" ALTER COLUMN "source" SET DEFAULT 'manual';

ALTER TABLE "leads" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "leads" ALTER COLUMN "status" SET DATA TYPE varchar(64) USING "status"::text;
ALTER TABLE "leads" ALTER COLUMN "status" SET DEFAULT 'new';

ALTER TABLE "lead_status_history" ALTER COLUMN "from_status" SET DATA TYPE varchar(64) USING "from_status"::text;
ALTER TABLE "lead_status_history" ALTER COLUMN "to_status" SET DATA TYPE varchar(64) USING "to_status"::text;

-- =============================================================
-- 4. Lead status + source configuration tables (tenant-scoped)
-- =============================================================
CREATE TABLE IF NOT EXISTS "lead_status_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "key" varchar(64) NOT NULL,
  "label" varchar(128) NOT NULL,
  "color" varchar(32),
  "order_index" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "lead_status_configs_org_key_idx" ON "lead_status_configs" ("organization_id", "key");
CREATE INDEX IF NOT EXISTS "lead_status_configs_org_order_idx" ON "lead_status_configs" ("organization_id", "order_index");

CREATE TABLE IF NOT EXISTS "lead_source_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "key" varchar(64) NOT NULL,
  "label" varchar(128) NOT NULL,
  "order_index" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "lead_source_configs_org_key_idx" ON "lead_source_configs" ("organization_id", "key");
CREATE INDEX IF NOT EXISTS "lead_source_configs_org_order_idx" ON "lead_source_configs" ("organization_id", "order_index");

-- =============================================================
-- 5. SaaS enums + subscriptions status type change
-- =============================================================
DO $$ BEGIN
  CREATE TYPE "subscription_status" AS ENUM ('trial', 'active', 'past_due', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "invitation_status" AS ENUM ('pending', 'accepted', 'expired', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "invoice_status" AS ENUM ('draft', 'issued', 'paid', 'void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "payment_status" AS ENUM ('pending', 'succeeded', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "subscriptions"
  ALTER COLUMN "status" SET DATA TYPE "subscription_status"
  USING "status"::text::"subscription_status";
ALTER TABLE "subscriptions" ALTER COLUMN "status" SET DEFAULT 'trial';

-- =============================================================
-- 6. Organization settings: integration preferences
-- =============================================================
ALTER TABLE "organization_settings" ADD COLUMN IF NOT EXISTS "integration_preferences" jsonb;

-- =============================================================
-- 7. Invitations, invoices, payments
-- =============================================================
CREATE TABLE IF NOT EXISTS "invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "email" varchar(320) NOT NULL,
  "role_id" uuid REFERENCES "roles"("id") ON DELETE set null,
  "token_hash" varchar(64) NOT NULL UNIQUE,
  "status" "invitation_status" DEFAULT 'pending' NOT NULL,
  "invited_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "expires_at" timestamp with time zone NOT NULL,
  "accepted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "invitations_org_email_idx" ON "invitations" ("organization_id", "email");
CREATE INDEX IF NOT EXISTS "invitations_token_hash_idx" ON "invitations" ("token_hash");
CREATE INDEX IF NOT EXISTS "invitations_status_idx" ON "invitations" ("organization_id", "status");

CREATE TABLE IF NOT EXISTS "invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "subscription_id" uuid REFERENCES "subscriptions"("id") ON DELETE set null,
  "invoice_number" varchar(32) NOT NULL,
  "amount" integer NOT NULL,
  "currency" varchar(3) DEFAULT 'INR' NOT NULL,
  "status" "invoice_status" DEFAULT 'issued' NOT NULL,
  "description" text,
  "issued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "paid_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_org_number_idx" ON "invoices" ("organization_id", "invoice_number");
CREATE INDEX IF NOT EXISTS "invoices_org_idx" ON "invoices" ("organization_id");

CREATE TABLE IF NOT EXISTS "payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "invoice_id" uuid REFERENCES "invoices"("id") ON DELETE set null,
  "provider" varchar(64) NOT NULL,
  "provider_reference" varchar(255),
  "amount" integer NOT NULL,
  "currency" varchar(3) DEFAULT 'INR' NOT NULL,
  "status" "payment_status" DEFAULT 'pending' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "payments_org_idx" ON "payments" ("organization_id");
CREATE INDEX IF NOT EXISTS "payments_invoice_idx" ON "payments" ("invoice_id");
