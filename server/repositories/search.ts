import { and, desc, eq, ilike, or } from "drizzle-orm";
import { TenantRepository } from "./base";
import {
  leads,
  clients,
  contacts,
  opportunities,
  tasks,
  meetings,
  activities,
  documents,
  users,
  pipelineStages,
} from "@/db/schema";

export interface SearchResult {
  entityType: string;
  id: string;
  title: string;
  subtitle: string | null;
  status: string | null;
  owner: string | null;
  href: string;
}

/**
 * Global, tenant-scoped search across leads, clients, contacts, opportunities,
 * tasks, meetings, activities, and documents. Server-side aggregation only.
 */
export class SearchRepository extends TenantRepository {
  async search(term: string, limit = 50): Promise<SearchResult[]> {
    if (!term.trim()) return [];
    const t = `%${term.trim()}%`;
    const org = this.organizationId;
    const results: SearchResult[] = [];

    // Leads
    const leadRows = await this.db
      .select({
        id: leads.id,
        name: leads.fullName,
        email: leads.email,
        company: leads.companyName,
        status: leads.status,
        owner: users.fullName,
      })
      .from(leads)
      .leftJoin(users, eq(leads.ownerId, users.id))
      .where(
        and(
          eq(leads.organizationId, org),
          eq(leads.isDeleted, false),
          or(
            ilike(leads.fullName, t),
            ilike(leads.email, t),
            ilike(leads.companyName, t),
            ilike(leads.phone, t),
            ilike(leads.leadNumber, t),
          )!,
        ),
      )
      .limit(limit);
    for (const r of leadRows) {
      results.push({
        entityType: "lead",
        id: r.id,
        title: r.name ?? r.email ?? "Lead",
        subtitle: [r.company, r.email].filter(Boolean).join(" · "),
        status: r.status,
        owner: r.owner,
        href: `/leads/${r.id}`,
      });
    }

    // Clients
    const clientRows = await this.db
      .select({
        id: clients.id,
        name: clients.companyName,
        industry: clients.industry,
        status: clients.status,
        owner: users.fullName,
      })
      .from(clients)
      .leftJoin(users, eq(clients.accountManagerId, users.id))
      .where(
        and(
          eq(clients.organizationId, org),
          eq(clients.isDeleted, false),
          or(ilike(clients.companyName, t), ilike(clients.clientNumber, t))!,
        ),
      )
      .limit(limit);
    for (const r of clientRows) {
      results.push({
        entityType: "client",
        id: r.id,
        title: r.name,
        subtitle: r.industry,
        status: r.status,
        owner: r.owner,
        href: `/clients/${r.id}`,
      });
    }

    // Contacts
    const contactRows = await this.db
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        phone: contacts.phone,
        clientName: clients.companyName,
      })
      .from(contacts)
      .leftJoin(clients, eq(contacts.clientId, clients.id))
      .where(
        and(
          eq(contacts.organizationId, org),
          eq(contacts.isDeleted, false),
          or(
            ilike(contacts.firstName, t),
            ilike(contacts.lastName, t),
            ilike(contacts.email, t),
            ilike(contacts.phone, t),
          )!,
        ),
      )
      .limit(limit);
    for (const r of contactRows) {
      results.push({
        entityType: "contact",
        id: r.id,
        title: `${r.firstName} ${r.lastName ?? ""}`.trim(),
        subtitle: [r.email, r.phone, r.clientName].filter(Boolean).join(" · "),
        status: null,
        owner: null,
        href: `/clients/${r.clientName ? "" : ""}`,
      });
    }

    // Opportunities
    const oppRows = await this.db
      .select({
        id: opportunities.id,
        name: opportunities.name,
        number: opportunities.opportunityNumber,
        stage: pipelineStages.name,
        owner: users.fullName,
      })
      .from(opportunities)
      .leftJoin(users, eq(opportunities.ownerId, users.id))
      .leftJoin(pipelineStages, eq(opportunities.stageId, pipelineStages.id))
      .where(
        and(
          eq(opportunities.organizationId, org),
          eq(opportunities.isDeleted, false),
          or(ilike(opportunities.name, t), ilike(opportunities.opportunityNumber, t))!,
        ),
      )
      .limit(limit);
    for (const r of oppRows) {
      results.push({
        entityType: "opportunity",
        id: r.id,
        title: r.name,
        subtitle: r.number,
        status: r.stage,
        owner: r.owner,
        href: `/opportunities/${r.id}`,
      });
    }

    // Tasks
    const taskRows = await this.db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        owner: users.fullName,
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedTo, users.id))
      .where(and(eq(tasks.organizationId, org), ilike(tasks.title, t)))
      .limit(limit);
    for (const r of taskRows) {
      results.push({
        entityType: "task",
        id: r.id,
        title: r.title,
        subtitle: null,
        status: r.status,
        owner: r.owner,
        href: `/tasks/${r.id}`,
      });
    }

    // Meetings
    const meetingRows = await this.db
      .select({
        id: meetings.id,
        title: meetings.title,
        status: meetings.status,
        owner: users.fullName,
      })
      .from(meetings)
      .leftJoin(users, eq(meetings.organizerId, users.id))
      .where(and(eq(meetings.organizationId, org), ilike(meetings.title, t)))
      .limit(limit);
    for (const r of meetingRows) {
      results.push({
        entityType: "meeting",
        id: r.id,
        title: r.title,
        subtitle: null,
        status: r.status,
        owner: r.owner,
        href: `/meetings/${r.id}`,
      });
    }

    // Activities
    const activityRows = await this.db
      .select({
        id: activities.id,
        subject: activities.subject,
        type: activities.type,
      })
      .from(activities)
      .where(
        and(
          eq(activities.organizationId, org),
          or(ilike(activities.subject, t), ilike(activities.notes, t))!,
        ),
      )
      .orderBy(desc(activities.occurredAt))
      .limit(limit);
    for (const r of activityRows) {
      results.push({
        entityType: "activity",
        id: r.id,
        title: r.subject ?? "Activity",
        subtitle: null,
        status: r.type,
        owner: null,
        href: `/activities`,
      });
    }

    // Documents
    const docRows = await this.db
      .select({
        id: documents.id,
        name: documents.name,
        status: documents.status,
      })
      .from(documents)
      .where(
        and(
          eq(documents.organizationId, org),
          eq(documents.isDeleted, false),
          ilike(documents.name, t),
        ),
      )
      .limit(limit);
    for (const r of docRows) {
      results.push({
        entityType: "document",
        id: r.id,
        title: r.name,
        subtitle: null,
        status: r.status,
        owner: null,
        href: `/documents/${r.id}`,
      });
    }

    return results.slice(0, limit);
  }
}
