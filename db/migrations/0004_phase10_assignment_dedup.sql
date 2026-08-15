-- Phase 10: Lead Assignment + Deduplication
-- 1. Extend lead_assignments with previous owner + reason.
ALTER TABLE "lead_assignments"
  ADD COLUMN "previous_owner_id" uuid,
  ADD COLUMN "reason" text;

-- 2. Extend leads with a self-referential merge target for dedup traceability.
ALTER TABLE "leads"
  ADD COLUMN "merged_into_id" uuid;

-- 3. New user_skills table.
CREATE TABLE "user_skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "skill" varchar(128) NOT NULL,
  "skill_type" varchar(32) NOT NULL,
  "proficiency" varchar(32) NOT NULL
);

CREATE INDEX "user_skills_user_idx" ON "user_skills" ("organization_id", "user_id");
CREATE INDEX "user_skills_type_idx" ON "user_skills" ("organization_id", "skill_type");

-- 4. New routing_rules table.
CREATE TABLE "routing_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "strategy" varchar(32) NOT NULL,
  "priority" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "condition_field" varchar(64) NOT NULL,
  "condition_value" varchar(128) NOT NULL,
  "target_user_id" uuid
);

CREATE INDEX "routing_rules_org_idx" ON "routing_rules" ("organization_id", "strategy", "active");

-- Foreign keys.
ALTER TABLE "lead_assignments"
  ADD CONSTRAINT "lead_assignments_previous_owner_id_users_id_fk"
  FOREIGN KEY ("previous_owner_id") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_merged_into_id_leads_id_fk"
  FOREIGN KEY ("merged_into_id") REFERENCES "leads"("id") ON DELETE SET NULL;

ALTER TABLE "user_skills"
  ADD CONSTRAINT "user_skills_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;

ALTER TABLE "user_skills"
  ADD CONSTRAINT "user_skills_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "routing_rules"
  ADD CONSTRAINT "routing_rules_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;

ALTER TABLE "routing_rules"
  ADD CONSTRAINT "routing_rules_target_user_id_users_id_fk"
  FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
