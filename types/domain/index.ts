/**
 * Domain type re-export barrel.
 *
 * These are the Drizzle-inferred database types. They are kept separate from
 * API response types (which add envelope/data-shaping concerns).
 */
export type {
  Organization,
  NewOrganization,
} from "@/db/schema/organizations";
export type { User, NewUser } from "@/db/schema/users";
export type { Role, Permission } from "@/db/schema/rbac";
export type {
  Lead,
  NewLead,
  Client,
  Contact,
} from "@/db/schema/sales";
export type { Opportunity, PipelineStage } from "@/db/schema/opportunities";
export type {
  Task,
  Activity,
  Meeting,
  Proposal,
  Notification,
} from "@/db/schema/operations";
export type { AiInsight } from "@/db/schema/ai";
export type { AuditLog } from "@/db/schema/system";
