import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { AiProvider, AiProviderError, AiProviderUnavailableError, parseAiResponse } from "../server/ai/provider";
import { serverEnv } from "../config/env";
import { z } from "zod";
import { sanitizeAuditValue } from "../lib/api/audit";
import { paymentProvider } from "../server/billing/provider";

const repo = path.resolve(import.meta.dirname ?? ".", "..");

test("unconfigured AI provider rejects instead of returning a generated result", async () => {
  const provider = new AiProvider({ baseUrl: "https://invalid.example", apiKey: "", model: "test" });
  await assert.rejects(provider.generateStructured({ system: "system", user: "user" }), AiProviderUnavailableError);
});

test("AI configuration replaces retired Groq model overrides with the current default", () => {
  const before = process.env.AI_MODEL;
  const originalWarn = console.warn;
  console.warn = () => {};
  process.env.AI_MODEL = "llama-3.3-70b-versatile";
  try {
    assert.equal(serverEnv.aiModel, "openai/gpt-oss-120b");
  } finally {
    console.warn = originalWarn;
    if (before === undefined) delete process.env.AI_MODEL;
    else process.env.AI_MODEL = before;
  }
});

test("AI provider errors never expose provider endpoint details or raw error messages", async () => {
  const originalFetch = globalThis.fetch;
  const secretEndpoint = "https://provider.example/path?token=do-not-disclose";
  globalThis.fetch = async () => { throw new Error(`request failed ${secretEndpoint}`); };
  try {
    const provider = new AiProvider({ baseUrl: secretEndpoint, apiKey: "test-key", model: "test-model" });
    await assert.rejects(provider.generateStructured({ system: "system", user: "user" }), (error: unknown) => {
      assert.ok(error instanceof AiProviderError);
      assert.doesNotMatch(error.message, /do-not-disclose|provider\.example/);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("malformed AI structures map to an upstream provider error", () => {
  assert.throws(
    () => parseAiResponse(z.object({ answer: z.string() }), { answer: 3 }),
    (error: unknown) => error instanceof AiProviderError && error.code === "AI_PROVIDER_ERROR",
  );
});

test("Groq model errors return actionable 502 errors without echoing provider text", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: { code: "model_not_found", message: "private provider detail" } }, { status: 404 });
  try {
    const provider = new AiProvider({ baseUrl: "https://provider.example/v1", apiKey: "test-key", model: "retired-model" });
    await assert.rejects(provider.generateStructured({ system: "system", user: "user" }), (error: unknown) => {
      assert.ok(error instanceof AiProviderError);
      assert.equal(error.status, 502);
      assert.match(error.message, /configured AI_MODEL is unavailable/);
      assert.doesNotMatch(error.message, /private provider detail/);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("shared overlays keep the latest close callback without restarting focus handling on each render", () => {
  const overlay = fs.readFileSync(path.join(repo, "components", "ui", "overlay.tsx"), "utf8");
  assert.match(overlay, /onCloseRef\.current\(\)/);
  assert.match(overlay, /\}, \[open\]\);/);
  assert.doesNotMatch(overlay, /\}, \[open,\s*onClose\]\);/);
});

test("organization settings permissions intentionally match the Admin configuration grant", () => {
  for (const route of ["lead-statuses", "lead-sources"]) {
    const source = fs.readFileSync(path.join(repo, "app", "api", "settings", route, "route.ts"), "utf8");
    assert.match(source, new RegExp(`requireApiContext\\("${route.replaceAll("-", "_")}\\.view"\\)`));
    assert.match(source, new RegExp(`requireApiContext\\("${route.replaceAll("-", "_")}\\.edit"\\)`));
  }
  const permissions = fs.readFileSync(path.join(repo, "lib", "permissions", "index.ts"), "utf8");
  assert.match(permissions, /perm\("lead_statuses", "view", "edit"\)/);
  assert.match(permissions, /perm\("lead_sources", "view", "edit"\)/);
});

test("audit export remains permission-gated and restricted roles see a clear explanation", () => {
  const page = fs.readFileSync(path.join(repo, "app", "(app)", "settings", "audit", "page.tsx"), "utf8");
  const api = fs.readFileSync(path.join(repo, "app", "api", "audit-logs", "route.ts"), "utf8");
  assert.match(page, /canExport \? \(/);
  assert.match(page, /CSV export is restricted for your role\./);
  assert.match(api, /audit_logs\.export/);
});

test("audit values redact nested credentials and payment provider remains unavailable without a real adapter", () => {
  assert.deepEqual(sanitizeAuditValue({ nested: { apiKey: "secret", label: "safe" } }), {
    nested: { apiKey: "[REDACTED]", label: "safe" },
  });
  assert.equal(paymentProvider.isConfigured(), false);
});
