import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { OrganizationRepository } from "@/server/repositories/organizations";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Input, Select } from "@/components/ui";
import { AuditEventDetail } from "@/components/admin/audit-event-detail";
import { sanitizeAuditValue } from "@/lib/api/audit";

export const metadata = { title: "Audit Logs" };
export const dynamic = "force-dynamic";

const actionVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  create: "success",
  update: "info",
  delete: "danger",
  status_change: "warning",
  assign: "info",
  approve: "success",
  export: "neutral",
  login: "neutral",
  logout: "neutral",
};

const ACTIONS = ["create", "update", "delete", "login", "logout", "export", "assign", "approve", "status_change"];

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

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const allowed = await userHasPermission(session.userId, session.organizationId, "audit_logs.view");
  if (!allowed) redirect("/forbidden");

  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const search = get("search").trim().slice(0, 200);
  const action = get("action").trim().slice(0, 64);
  const actor = get("actor").trim().slice(0, 200);
  const entityType = get("entityType").trim().slice(0, 64);
  const from = get("from").trim();
  const to = get("to").trim();
  const page = Math.max(Number(get("page") || "1") || 1, 1);
  const pageSize = 25;
  const offset = (page - 1) * pageSize;

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
    conditions.push(or(ilike(users.fullName, term), ilike(users.email, term))!);
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
  const [settings, profile, rows, countRow] = await Promise.all([
    orgRepo.getSettings(),
    orgRepo.getProfile(),
    db
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
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .leftJoin(users, and(eq(auditLogs.userId, users.id), eq(users.organizationId, session.organizationId)))
      .where(where),
  ]);

  const total = countRow[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const timeZone = settings?.timezone ?? profile?.timezone ?? "UTC";

  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (action) query.set("action", action);
  if (actor) query.set("actor", actor);
  if (entityType) query.set("entityType", entityType);
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  const exportHref = `/api/audit-logs?format=csv&${query.toString()}`;
  const pageHref = (p: number) => {
    const q = new URLSearchParams(query.toString());
    q.set("page", String(p));
    return `?${q.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description={`Administrative actions for your organization. Times shown in ${timeZone}.`}
        actions={
          <a
            href={exportHref}
            className="inline-flex h-8 items-center rounded-md border border-border-strong bg-transparent px-3 text-sm text-foreground transition-colors hover:bg-surface-subtle"
          >
            Export CSV
          </a>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and narrow the audit trail.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="GET" className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Input name="search" defaultValue={search} placeholder="Search action, entity, ID…" aria-label="Search audit logs" />
            <Select name="action" defaultValue={action} aria-label="Filter by action">
              <option value="">All actions</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
            <Input name="actor" defaultValue={actor} placeholder="Actor name or email…" aria-label="Filter by actor" />
            <Input name="entityType" defaultValue={entityType} placeholder="Entity type…" aria-label="Filter by entity type" />
            <Input name="from" type="date" defaultValue={from} aria-label="From date" />
            <Input name="to" type="date" defaultValue={to} aria-label="To date" />
            <div className="flex gap-2 sm:col-span-3 lg:col-span-6">
              <Button type="submit" size="sm">
                Apply filters
              </Button>
              <Link
                href="/settings/audit"
                className="inline-flex h-8 items-center rounded-md border border-border-strong bg-transparent px-3 text-sm text-foreground transition-colors hover:bg-surface-subtle"
              >
                Clear
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Events ({total})</CardTitle>
          <CardDescription>
            Page {page} of {totalPages}. Existing records are preserved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>When ({timeZone})</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const displayAt = formatInTimezone(r.createdAt, timeZone);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Badge variant={actionVariant[r.action] ?? "neutral"}>{r.action}</Badge>
                    </TableCell>
                    <TableCell>{r.entityType}{r.entityId ? ` (${r.entityId.slice(0, 8)})` : ""}</TableCell>
                    <TableCell>{r.actorName ?? "System"}</TableCell>
                    <TableCell suppressHydrationWarning>{displayAt}</TableCell>
                    <TableCell>
                      <AuditEventDetail
                        event={{
                          id: r.id,
                          action: r.action,
                          entityType: r.entityType,
                          entityId: r.entityId,
                          actorName: r.actorName,
                          displayAt,
                          metadata: sanitizeAuditValue(r.metadata),
                          previousValue: sanitizeAuditValue(r.previousValue),
                          newValue: sanitizeAuditValue(r.newValue),
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    No audit events match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages} · {total} events
            </span>
            <div className="flex gap-2">
              <Link
                href={pageHref(Math.max(1, page - 1))}
                aria-disabled={page <= 1}
                className={`inline-flex h-8 items-center rounded-md border border-border-strong px-3 text-sm ${page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-surface-subtle"}`}
              >
                Previous
              </Link>
              <Link
                href={pageHref(Math.min(totalPages, page + 1))}
                aria-disabled={page >= totalPages}
                className={`inline-flex h-8 items-center rounded-md border border-border-strong px-3 text-sm ${page >= totalPages ? "pointer-events-none opacity-50" : "hover:bg-surface-subtle"}`}
              >
                Next
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
