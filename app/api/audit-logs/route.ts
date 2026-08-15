import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { success, failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiContext("audit_logs.view");
    const url = req.nextUrl;
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Math.min(Number(url.searchParams.get("pageSize") ?? "25"), 100);
    const offset = (page - 1) * pageSize;

    const where = eq(auditLogs.organizationId, session.organizationId);

    const rows = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        actorName: users.fullName,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset(offset);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(where);

    return success(rows, {
      message: "OK",
      meta: { page, pageSize, total: countRow?.count ?? 0 },
    });
  } catch (error) {
    return failure(error);
  }
}
