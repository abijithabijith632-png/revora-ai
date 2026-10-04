import { NextRequest } from "next/server";
import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { success, failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { recordAudit, sanitizeAuditValue } from "@/lib/api/audit";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { OrganizationRepository } from "@/server/repositories/organizations";

const MAX_EXPORT_ROWS = 5_000;

function escapeCsv(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function formatInTimezone(iso: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString();
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const format = (url.searchParams.get("format") ?? "json").toLowerCase();
    const session = await requireApiContext(
      format === "csv" ? "audit_logs.export" : "audit_logs.view",
    );

    const page = Math.max(Number(url.searchParams.get("page") ?? "1") || 1, 1);
    const pageSize = Math.min(Number(url.searchParams.get("pageSize") ?? "25") || 25, 100);
    const offset = (page - 1) * pageSize;

    const search = (url.searchParams.get("search") ?? "").trim().slice(0, 200);
    const action = (url.searchParams.get("action") ?? "").trim().slice(0, 64);
    const actor = (url.searchParams.get("actor") ?? "").trim().slice(0, 200);
    const entityType = (url.searchParams.get("entityType") ?? "").trim().slice(0, 64);
    const from = (url.searchParams.get("from") ?? "").trim();
    const to = (url.searchParams.get("to") ?? "").trim();

    const conditions: SQL[] = [eq(auditLogs.organizationId, session.organizationId)];
    if (search) {
      const term = `%${search}%`;
      conditions.push(
        or(
          ilike(auditLogs.action, term),
          ilike(auditLogs.entityType, term),
          sql`${auditLogs.entityId}::text ILIKE ${term}`,
        )!,
      );
    }
    if (action) conditions.push(eq(auditLogs.action, action as never));
    if (entityType) conditions.push(eq(auditLogs.entityType, entityType));
    if (actor) {
      const term = `%${actor}%`;
      conditions.push(
        or(ilike(users.fullName, term), ilike(users.email, term))!,
      );
    }
    if (from && !Number.isNaN(Date.parse(from))) {
      conditions.push(gte(auditLogs.createdAt, new Date(from)));
    }
    if (to && !Number.isNaN(Date.parse(to))) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(auditLogs.createdAt, end));
    }
    const where = and(...conditions)!;

    const orgRepo = new OrganizationRepository(session.organizationId);
    const { settings, profile } = await orgRepo.getSettings().then(
      async (settings) => ({ settings, profile: await orgRepo.getProfile() }),
    );
    const timeZone = settings?.timezone ?? profile?.timezone ?? "UTC";

    if (format === "csv") {
      const rows = await db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          actorName: users.fullName,
          metadata: auditLogs.metadata,
          previousValue: auditLogs.previousValue,
          newValue: auditLogs.newValue,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .leftJoin(users, and(eq(auditLogs.userId, users.id), eq(users.organizationId, session.organizationId)))
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(MAX_EXPORT_ROWS);

      await recordAudit({
        organizationId: session.organizationId,
        userId: session.userId,
        action: "export",
        entityType: "audit_log",
        metadata: { format: "csv", count: rows.length },
      });

      const header = ["id", "action", "entity_type", "entity_id", "actor", `when_${timeZone}`, "previous_value", "new_value", "metadata"];
      const lines = [header.join(",")];
      for (const r of rows) {
        lines.push(
          [
            r.id,
            r.action,
            r.entityType,
            r.entityId ?? "",
            r.actorName ?? "System",
            formatInTimezone(r.createdAt, timeZone),
            JSON.stringify(sanitizeAuditValue(r.previousValue ?? null)),
            JSON.stringify(sanitizeAuditValue(r.newValue ?? null)),
            JSON.stringify(sanitizeAuditValue(r.metadata ?? null)),
          ]
            .map(escapeCsv)
            .join(","),
        );
      }
      return new Response(lines.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    const rows = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        userId: auditLogs.userId,
        actorName: users.fullName,
        metadata: auditLogs.metadata,
        previousValue: auditLogs.previousValue,
        newValue: auditLogs.newValue,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, and(eq(auditLogs.userId, users.id), eq(users.organizationId, session.organizationId)))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset(offset);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .leftJoin(users, and(eq(auditLogs.userId, users.id), eq(users.organizationId, session.organizationId)))
      .where(where);

    return success(
      rows.map((r) => ({
        ...r,
        metadata: sanitizeAuditValue(r.metadata),
        previousValue: sanitizeAuditValue(r.previousValue),
        newValue: sanitizeAuditValue(r.newValue),
        displayAt: formatInTimezone(r.createdAt, timeZone),
        timeZone,
      })),
      {
        message: "OK",
        meta: {
          page,
          pageSize,
          total: countRow?.count ?? 0,
          totalPages: Math.ceil((countRow?.count ?? 0) / pageSize),
        },
      },
    );
  } catch (error) {
    return failure(error);
  }
}
