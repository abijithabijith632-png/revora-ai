import "dotenv/config";
import { db, pool } from "./index";
import { organizations, users, auditLogs } from "./schema";
import { eq } from "drizzle-orm";
import {
  parsePagination,
  parseSort,
  parseSearch,
  buildPaginationMeta,
  MAX_PAGE_SIZE,
} from "@/lib/api/query";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { recordAudit } from "@/lib/api/audit";
import { ValidationError, RateLimitedError } from "@/lib/errors";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAILED: ${label}`);
  console.log(`  ✓ ${label}`);
}

async function cleanup() {
  const orgs = await db.select().from(organizations).where(eq(organizations.slug, "api-smoke"));
  for (const o of orgs) {
    await db.delete(auditLogs).where(eq(auditLogs.organizationId, o.id));
    const u = await db.select({ id: users.id }).from(users).where(eq(users.organizationId, o.id));
    for (const row of u) await db.delete(users).where(eq(users.id, row.id));
    await db.delete(organizations).where(eq(organizations.id, o.id));
  }
}

async function main() {
  console.log("[api-smoke] Starting API foundation smoke test...");
  await cleanup();

  // ---- Pagination ----
  const p1 = parsePagination(new URL("http://x/?page=2&pageSize=50"));
  assert(p1.page === 2 && p1.pageSize === 50 && p1.offset === 50, "pagination parse");

  let oversizedRejected = false;
  try {
    parsePagination(new URL("http://x/?pageSize=999999"));
  } catch (e) {
    oversizedRejected = e instanceof ValidationError;
  }
  assert(oversizedRejected, `oversized page size rejected (max ${MAX_PAGE_SIZE})`);

  // ---- Sort allowlist ----
  const sort = parseSort(new URL("http://x/?sortBy=createdAt&sortOrder=asc"), ["createdAt", "name"] as const, "createdAt");
  assert(sort.column === "createdAt" && sort.order === "asc", "sort allowlist valid");

  const unsafeSort = parseSort(new URL("http://x/?sortBy=password_hash&sortOrder=desc"), ["createdAt", "name"] as const, "createdAt");
  assert(unsafeSort.column === "createdAt", "unsafe sort field falls back to default");

  // ---- Search ----
  assert(parseSearch(new URL("http://x/?search=abc")) === "abc", "search parsed");
  assert(parseSearch(new URL("http://x/")) === "", "empty search");

  // ---- Pagination meta ----
  const meta = buildPaginationMeta(105, { page: 3, pageSize: 20, offset: 40 });
  assert(meta.totalPages === 6 && meta.total === 105, "pagination meta");

  // ---- Rate limit ----
  rateLimitKey(undefined, "127.0.0.1");
  let limited = false;
  try {
    for (let i = 0; i < 4; i++) checkRateLimit(`test-${Date.now()}`, 3, 60_000);
  } catch (e) {
    limited = e instanceof RateLimitedError;
  }
  assert(limited, "rate limit enforced");

  // ---- Audit (against real DB) ----
  const [org] = await db.insert(organizations).values({ name: "API Smoke", slug: "api-smoke" }).returning();
  await recordAudit({ organizationId: org.id, action: "create", entityType: "test", entityId: org.id, metadata: { ok: true } });
  const audit = await db.query.auditLogs.findFirst({ where: eq(auditLogs.organizationId, org.id) });
  assert(!!audit && audit.action === "create", "audit recorded");

  await cleanup();
  console.log("[api-smoke] All API foundation smoke tests passed.");
}

main()
  .catch((err) => {
    console.error("[api-smoke] FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
