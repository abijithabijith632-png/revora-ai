import test from "node:test";
import assert from "node:assert/strict";
import { calculateBuyingIntent } from "../server/ai/buying-intent";

test("buying intent reports insufficient data without manufacturing a score", () => {
  const result = calculateBuyingIntent({ activity: 0, recent: 0, meetings: 0, proposals: 0, engagement: 0 }, new Date("2026-01-01T00:00:00.000Z"));
  assert.equal(result.level, "Insufficient data");
  assert.equal(result.score, null);
  assert.deepEqual(result.signals, []);
});

test("buying intent uses recorded engagement and includes traceable signals", () => {
  const result = calculateBuyingIntent({ activity: 8, recent: 3, meetings: 1, proposals: 1, engagement: 0 }, new Date("2026-01-01T00:00:00.000Z"));
  assert.equal(result.level, "High");
  assert.equal(result.score, 64);
  assert.equal(result.signals.length, 3);
  assert.match(result.explanation, /not external intent data/);
});

test("a single recorded activity produces a low first-party intent score", () => {
  const result = calculateBuyingIntent({ activity: 1, recent: 1, meetings: 0, proposals: 0, engagement: 0 });
  assert.equal(result.level, "Low");
  assert.equal(result.score, 8);
});
