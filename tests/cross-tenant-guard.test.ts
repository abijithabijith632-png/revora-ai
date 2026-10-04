import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname ?? ".", "..");

function listRouteFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "route.ts") out.push(p);
    }
  };
  walk(path.join(REPO, "app", "api"));
  return out;
}

test("no API route trusts client-supplied organization id as tenant authority", () => {
  const files = listRouteFiles();
  assert.ok(files.length > 80, `expected many routes, found ${files.length}`);
  const offenders: string[] = [];
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    // Heuristic: parsing organizationId/orgId from body/query and using it for scoping.
    if (/body.*organizationId|organizationId.*body|searchParams\.get\(["']org/i.test(src)) {
      // Allow health/settings reads that echo but still require session scoping.
      if (!src.includes("requireApiContext") && !src.includes("requireSession") && !src.includes("getSession")) {
        offenders.push(path.relative(REPO, f));
      }
    }
  }
  assert.deepEqual(offenders, [], `routes missing session scoping: ${offenders.join(", ")}`);
});
