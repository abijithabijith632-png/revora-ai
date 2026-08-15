ALTER TYPE "public"."lead_source" ADD VALUE 'google_search';--> statement-breakpoint
ALTER TYPE "public"."lead_source" ADD VALUE 'partner_referral';--> statement-breakpoint
ALTER TYPE "public"."lead_source" ADD VALUE 'paid_advertisements';--> statement-breakpoint
ALTER TYPE "public"."lead_source" ADD VALUE 'cold_calls';--> statement-breakpoint
ALTER TYPE "public"."lead_source" ADD VALUE 'direct_email';--> statement-breakpoint
ALTER TYPE "public"."lead_source" ADD VALUE 'tradeshows_events';--> statement-breakpoint
ALTER TYPE "public"."lead_source" ADD VALUE 'existing_customers';--> statement-breakpoint
ALTER TYPE "public"."lead_source" ADD VALUE 'others';--> statement-breakpoint
CREATE TABLE "lead_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"from_status" "lead_status",
	"to_status" "lead_status" NOT NULL,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "first_name" varchar(128);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "last_name" varchar(128);--> statement-breakpoint
ALTER TABLE "lead_status_history" ADD CONSTRAINT "lead_status_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_status_history" ADD CONSTRAINT "lead_status_history_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_status_history" ADD CONSTRAINT "lead_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_status_history_lead_idx" ON "lead_status_history" USING btree ("organization_id","lead_id");--> statement-breakpoint
CREATE INDEX "lead_status_history_changed_idx" ON "lead_status_history" USING btree ("organization_id","changed_at");--> statement-breakpoint
UPDATE "leads"
SET
  "first_name" = CASE
    WHEN position(' ' in "full_name") > 0 THEN split_part("full_name", ' ', 1)
    ELSE "full_name"
  END,
  "last_name" = CASE
    WHEN position(' ' in "full_name") > 0 THEN substr("full_name", position(' ' in "full_name") + 1)
    ELSE NULL
  END
WHERE
  "first_name" IS NULL
  AND "last_name" IS NULL
  AND "full_name" IS NOT NULL
  AND "full_name" <> '';