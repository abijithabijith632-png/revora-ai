-- Phase 8: Lead Lifecycle & Qualification Engine
-- 1. Extend the qualification outcome enum with Track A values.
ALTER TYPE "lead_qualification_status" ADD VALUE 'partially_qualified';
ALTER TYPE "lead_qualification_status" ADD VALUE 'unqualified';

-- 2. Structured qualification criteria enums.
CREATE TYPE "requirement_clarity" AS ENUM ('clear', 'partially_clear', 'unclear', 'unknown');
CREATE TYPE "budget_availability" AS ENUM ('confirmed', 'estimated', 'not_confirmed', 'unknown');
CREATE TYPE "purchase_timeline" AS ENUM ('immediate', '0_30_days', '31_90_days', '3_6_months', '6_plus_months', 'unknown');
CREATE TYPE "decision_maker" AS ENUM ('identified', 'partially_identified', 'not_identified', 'unknown');
CREATE TYPE "company_scale" AS ENUM ('strong_fit', 'moderate_fit', 'weak_fit', 'unknown');
CREATE TYPE "product_fit" AS ENUM ('strong_fit', 'partial_fit', 'weak_fit', 'unknown');
CREATE TYPE "conversion_probability" AS ENUM ('high', 'medium', 'low', 'unknown');
CREATE TYPE "disqualification_reason" AS ENUM ('no_budget', 'poor_product_fit', 'no_decision_maker', 'no_active_requirement', 'timeline_too_distant', 'duplicate', 'other');

-- 3. Restructure lead_qualifications (integer → structured enum criteria).
ALTER TABLE "lead_qualifications"
  DROP COLUMN "requirement_clarity",
  DROP COLUMN "budget",
  DROP COLUMN "purchase_timeline",
  DROP COLUMN "decision_maker",
  DROP COLUMN "company_scale",
  DROP COLUMN "product_fit";

ALTER TABLE "lead_qualifications"
  ADD COLUMN "requirement_clarity" "requirement_clarity" NOT NULL DEFAULT 'unknown',
  ADD COLUMN "budget_availability" "budget_availability" NOT NULL DEFAULT 'unknown',
  ADD COLUMN "purchase_timeline" "purchase_timeline" NOT NULL DEFAULT 'unknown',
  ADD COLUMN "decision_maker" "decision_maker" NOT NULL DEFAULT 'unknown',
  ADD COLUMN "company_scale" "company_scale" NOT NULL DEFAULT 'unknown',
  ADD COLUMN "product_fit" "product_fit" NOT NULL DEFAULT 'unknown',
  ADD COLUMN "conversion_probability" "conversion_probability" NOT NULL DEFAULT 'unknown',
  ADD COLUMN "decision_maker_name" varchar(255),
  ADD COLUMN "decision_maker_designation" varchar(128),
  ADD COLUMN "reason" "disqualification_reason";

-- Backfill + enforce non-null `qualified_at`.
UPDATE "lead_qualifications" SET "qualified_at" = now() WHERE "qualified_at" IS NULL;
ALTER TABLE "lead_qualifications" ALTER COLUMN "qualified_at" SET DEFAULT now();
ALTER TABLE "lead_qualifications" ALTER COLUMN "qualified_at" SET NOT NULL;

-- 4. Extend lifecycle history with a controlled disqualification reason.
ALTER TABLE "lead_status_history" ADD COLUMN "reason" "disqualification_reason";
