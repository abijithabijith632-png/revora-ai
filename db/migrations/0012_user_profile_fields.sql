-- Phase 18: Profile contact fields (additive, nullable, safe to re-run).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" varchar(32);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "location" varchar(128);
