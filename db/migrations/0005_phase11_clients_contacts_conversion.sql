-- Phase 11: Client Management + Contacts + Lead Conversion
-- 1. Extend clients with human-readable ID + Track A fields.
ALTER TABLE "clients"
  ADD COLUMN "client_number" varchar(32),
  ADD COLUMN "company_size" varchar(64),
  ADD COLUMN "corporate_info" text,
  ADD COLUMN "billing_address" text;

-- Backfill client_number for any pre-existing rows (deterministic + org-scoped).
WITH ranked AS (
  SELECT
    "id",
    'CL-' || to_char(
      row_number() OVER (PARTITION BY "organization_id" ORDER BY "created_at" ASC) + 1023,
      'FM9999'
    ) AS "client_number"
  FROM "clients"
)
UPDATE "clients" SET "client_number" = ranked."client_number"
FROM ranked
WHERE "clients"."id" = ranked."id";

-- Enforce non-null after backfill.
ALTER TABLE "clients" ALTER COLUMN "client_number" SET NOT NULL;

-- 2. Unique client number per tenant.
CREATE UNIQUE INDEX "clients_org_number_idx"
  ON "clients" ("organization_id", "client_number");

-- Concurrency guard: a lead converts to at most one client per tenant.
CREATE UNIQUE INDEX "clients_org_source_lead_idx"
  ON "clients" ("organization_id", "source_lead_id")
  WHERE "source_lead_id" IS NOT NULL;

CREATE INDEX "clients_company_idx"
  ON "clients" ("organization_id", "company_name");

CREATE INDEX "clients_customer_since_idx"
  ON "clients" ("organization_id", "customer_since");

-- 3. Contact indexes + single-primary-per-client constraint.
CREATE INDEX "contacts_org_phone_idx"
  ON "contacts" ("organization_id", "phone");

CREATE INDEX "contacts_name_idx"
  ON "contacts" ("organization_id", "first_name", "last_name");

CREATE UNIQUE INDEX "contacts_org_client_primary_idx"
  ON "contacts" ("organization_id", "client_id")
  WHERE "is_primary" = true;
