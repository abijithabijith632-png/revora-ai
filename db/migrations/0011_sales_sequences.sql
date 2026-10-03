CREATE TABLE "sales_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_sequences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE restrict,
	CONSTRAINT "sales_sequences_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE "sales_sequence_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sequence_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"next_run_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_sequence_enrollments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE restrict,
	CONSTRAINT "sales_sequence_enrollments_sequence_id_sales_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "sales_sequences"("id") ON DELETE cascade,
	CONSTRAINT "sales_sequence_enrollments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE cascade,
	CONSTRAINT "sales_sequence_enrollments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE "sales_sequence_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"step_index" integer NOT NULL,
	"result" varchar(32) NOT NULL,
	"details" jsonb,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_sequence_executions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE restrict,
	CONSTRAINT "sales_sequence_executions_enrollment_id_sales_sequence_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "sales_sequence_enrollments"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "sales_sequences_org_status_idx" ON "sales_sequences" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "sales_sequence_enrollment_unique_idx" ON "sales_sequence_enrollments" USING btree ("organization_id","sequence_id","lead_id");
--> statement-breakpoint
CREATE INDEX "sales_sequence_enrollment_due_idx" ON "sales_sequence_enrollments" USING btree ("organization_id","status","next_run_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "sales_sequence_execution_once_idx" ON "sales_sequence_executions" USING btree ("organization_id","enrollment_id","step_index");
--> statement-breakpoint
CREATE INDEX "sales_sequence_execution_org_time_idx" ON "sales_sequence_executions" USING btree ("organization_id","executed_at");
