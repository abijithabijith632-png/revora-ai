import { eq } from "drizzle-orm";
import { TenantRepository } from "./base";
import {
  organizations,
  organizationSettings,
  subscriptions,
  plans,
  leads,
  users,
  aiInsights,
  documents,
} from "@/db/schema";
import { sql } from "drizzle-orm";

/**
 * Organization + settings repository (Phase 16).
 * All queries are tenant-scoped; org profile + settings live together.
 */

export class OrganizationRepository extends TenantRepository {
  async getProfile() {
    const [row] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, this.organizationId))
      .limit(1);
    return row ?? null;
  }

  async getSettings() {
    const [row] = await this.db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, this.organizationId))
      .limit(1);
    return row ?? null;
  }

  async updateProfile(input: {
    name?: string;
    description?: string | null;
    website?: string | null;
    industry?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    address?: string | null;
    logoUrl?: string | null;
    timezone?: string;
    currency?: string;
  }) {
    const [row] = await this.db
      .update(organizations)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(organizations.id, this.organizationId))
      .returning();
    return row;
  }

  async updateSettings(input: {
    timezone?: string;
    currency?: string;
    dateFormat?: string;
    notificationPreferences?: unknown;
    brandingPreferences?: unknown;
    aiPreferences?: unknown;
    integrationPreferences?: unknown;
  }) {
    const existing = await this.getSettings();
    if (existing) {
      const [row] = await this.db
        .update(organizationSettings)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(organizationSettings.organizationId, this.organizationId))
        .returning();
      return row;
    }
    const [row] = await this.db
      .insert(organizationSettings)
      .values({
        organizationId: this.organizationId,
        timezone: input.timezone ?? "UTC",
        currency: input.currency ?? "INR",
        dateFormat: input.dateFormat ?? "MMM d, yyyy",
        notificationPreferences: input.notificationPreferences ?? {},
        brandingPreferences: input.brandingPreferences ?? {},
        aiPreferences: input.aiPreferences ?? {},
        integrationPreferences: input.integrationPreferences ?? {},
      })
      .returning();
    return row;
  }

  /** Real-data usage snapshot for feature gating / usage tracking. */
  async usage() {
    const [usersRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.organizationId, this.organizationId));

    const [leadsRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.organizationId, this.organizationId));

    const [aiRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiInsights)
      .where(eq(aiInsights.organizationId, this.organizationId));

    const [docRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(documents)
      .where(eq(documents.organizationId, this.organizationId));

    return {
      users: usersRow?.count ?? 0,
      leads: leadsRow?.count ?? 0,
      aiRequests: aiRow?.count ?? 0,
      documents: docRow?.count ?? 0,
    };
  }

  /** Active subscription with plan, if any. */
  async subscription() {
    const [row] = await this.db
      .select({
        subscription: subscriptions,
        plan: plans,
      })
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.organizationId, this.organizationId))
      .limit(1);
    return row ?? null;
  }
}
