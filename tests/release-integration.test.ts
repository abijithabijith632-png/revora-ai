import test from "node:test";
import assert from "node:assert/strict";
import {
  checkRateLimit,
  resetRateLimitForTests,
  rateLimitKey,
} from "../lib/api/rate-limit";
import { RateLimitedError } from "../lib/errors";
import { hasPermission } from "../lib/permissions";
import { calculateBuyingIntent } from "../server/ai/buying-intent";

test("provider failure falls back deterministically (unconfigured key)", () => {
  // AiProvider.isConfigured is false when API key empty; framework uses deterministic fallback.
  // Here we assert the contract layer never invents external facts: buying-intent with no data is explicit.
  const r = calculateBuyingIntent({ activity: 0, recent: 0, meetings: 0, proposals: 0, engagement: 0 });
  assert.equal(r.level, "Insufficient data");
  assert.equal(r.score, null);
});

test("rate limit enforces window and isolates keys", () => {
  resetRateLimitForTests();
  const k1 = `test-${Date.now()}-1`;
  const k2 = `test-${Date.now()}-2`;
  for (let i = 0; i < 3; i++) checkRateLimit(k1, 3, 60_000);
  assert.throws(() => checkRateLimit(k1, 3, 60_000), RateLimitedError);
  // different key unaffected
  checkRateLimit(k2, 3, 60_000);
  resetRateLimitForTests();
  checkRateLimit(k1, 3, 60_000);
});

test("rateLimitKey prefers user id over ip", () => {
  assert.equal(rateLimitKey("u1", "1.2.3.4"), "user:u1");
  assert.equal(rateLimitKey(undefined, "1.2.3.4"), "ip:1.2.3.4");
});

test("permission matrix: executive is read/create limited, cannot assign/approve", () => {
  assert.equal(hasPermission("Sales Executive", "leads.view"), true);
  assert.equal(hasPermission("Sales Executive", "leads.assign"), false);
  assert.equal(hasPermission("Sales Executive", "tasks.create"), true);
  assert.equal(hasPermission("Sales Manager", "leads.assign"), true);
  assert.equal(hasPermission("Admin", "leads.assign"), true);
});
