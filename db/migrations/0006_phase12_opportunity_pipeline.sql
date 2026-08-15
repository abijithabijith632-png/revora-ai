-- Phase 12: Opportunity Management + Sales Pipeline
-- 1. Pipeline stages: canonical key + terminal flag.
ALTER TABLE "pipeline_stages" ADD COLUMN "key" varchar(32);
ALTER TABLE "pipeline_stages" ADD COLUMN "is_terminal" boolean DEFAULT false NOT NULL;

UPDATE "pipeline_stages" SET "key" = CASE
  WHEN lower("name") = 'new' THEN 'new'
  WHEN lower("name") = 'qualified' THEN 'qualified'
  WHEN lower("name") = 'proposal' THEN 'proposal'
  WHEN lower("name") = 'negotiation' THEN 'negotiation'
  WHEN lower("name") = 'final review' THEN 'final_review'
  WHEN lower("name") IN ('won', 'closed') THEN 'won'
  WHEN lower("name") = 'lost' THEN 'lost'
  ELSE lower(replace("name", ' ', '_'))
END
WHERE "key" IS NULL;

UPDATE "pipeline_stages" SET "is_terminal" = true
WHERE lower("name") IN ('won', 'lost', 'closed');

ALTER TABLE "pipeline_stages" ALTER COLUMN "key" SET NOT NULL;

CREATE UNIQUE INDEX "pipeline_stages_org_key_idx"
  ON "pipeline_stages" ("organization_id", "key");

-- 2. Opportunities: human-readable identifier.
ALTER TABLE "opportunities" ADD COLUMN "opportunity_number" varchar(32);

WITH ranked AS (
  SELECT
    "id",
    'OPP-' || to_char(
      row_number() OVER (PARTITION BY "organization_id" ORDER BY "created_at" ASC) + 300,
      'FM999'
    ) AS "opportunity_number"
  FROM "opportunities"
)
UPDATE "opportunities" SET "opportunity_number" = ranked."opportunity_number"
FROM ranked
WHERE "opportunities"."id" = ranked."id";

ALTER TABLE "opportunities" ALTER COLUMN "opportunity_number" SET NOT NULL;

CREATE UNIQUE INDEX "opportunities_org_number_idx"
  ON "opportunities" ("organization_id", "opportunity_number");

CREATE INDEX "opportunities_expected_close_idx"
  ON "opportunities" ("organization_id", "expected_close_date");

-- 3. Stage history: probability snapshots.
ALTER TABLE "opportunity_stage_history"
  ADD COLUMN "previous_probability" integer,
  ADD COLUMN "new_probability" integer;
