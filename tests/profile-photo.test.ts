import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  detectProfilePhotoMime,
  MAX_PROFILE_PHOTO_BYTES,
  profilePhotoExtensionMatchesMime,
} from "../lib/profile-photo-validation";
import { PERMISSION_RESOURCES } from "../lib/permissions";

const REPO = path.resolve(import.meta.dirname ?? ".", "..");

test("profile photo type is identified from PNG and JPEG signatures", () => {
  assert.equal(detectProfilePhotoMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(detectProfilePhotoMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(detectProfilePhotoMime(Uint8Array.from([0x25, 0x50, 0x44, 0x46])), null);
  assert.equal(detectProfilePhotoMime(Uint8Array.from([0x3c, 0x73, 0x76, 0x67])), null);
});

test("profile photo extension must match detected MIME and size cap is five MiB", () => {
  assert.equal(profilePhotoExtensionMatchesMime("portrait.PNG", "image/png"), true);
  assert.equal(profilePhotoExtensionMatchesMime("portrait.jpeg", "image/jpeg"), true);
  assert.equal(profilePhotoExtensionMatchesMime("portrait.jpg", "image/jpeg"), true);
  assert.equal(profilePhotoExtensionMatchesMime("portrait.pdf", "image/jpeg"), false);
  assert.equal(MAX_PROFILE_PHOTO_BYTES, 5 * 1024 * 1024);
});

test("profile photo storage routes authenticate and scope reads to the session user and organization", () => {
  const uploadRoute = fs.readFileSync(path.join(REPO, "app", "api", "auth", "profile", "photo-upload", "route.ts"), "utf8");
  const photoRoute = fs.readFileSync(path.join(REPO, "app", "api", "auth", "profile", "photo", "route.ts"), "utf8");
  const profileRoute = fs.readFileSync(path.join(REPO, "app", "api", "auth", "profile", "route.ts"), "utf8");
  assert.match(uploadRoute, /requireSession\(\)/);
  assert.match(uploadRoute, /session\.organizationId.*session\.userId/s);
  assert.match(uploadRoute, /maximumSizeInBytes: MAX_PROFILE_PHOTO_BYTES/);
  assert.match(photoRoute, /requireSession\(\)/);
  assert.match(photoRoute, /eq\(users\.id, session\.userId\)/);
  assert.match(photoRoute, /eq\(users\.organizationId, session\.organizationId\)/);
  assert.match(profileRoute, /requireSession\(\)/);
  assert.match(profileRoute, /validateUploadedProfilePhoto/);
});

test("optional Assistant and Agent modules are absent while required AI routes remain", () => {
  const removedPaths = [
    "app/(app)/ai-assistant/page.tsx",
    "app/(app)/ai-agents/page.tsx",
    "app/api/ai/copilot/route.ts",
    "app/api/ai/email-draft/route.ts",
    "app/api/ai/conversation-analysis/route.ts",
    "app/api/agents/[agentId]/route.ts",
    "app/api/agents/actions/route.ts",
  ];
  for (const relativePath of removedPaths) {
    assert.equal(fs.existsSync(path.join(REPO, relativePath)), false, relativePath);
  }
  const navigation = fs.readFileSync(path.join(REPO, "components", "layout", "nav.ts"), "utf8");
  assert.doesNotMatch(navigation, /AI Assistant|AI Agents|\/ai-assistant|\/ai-agents/);
  assert.equal(fs.existsSync(path.join(REPO, "app", "api", "leads", "[id]", "ai-score", "route.ts")), true);
  assert.equal(fs.existsSync(path.join(REPO, "app", "api", "meetings", "[id]", "summary", "route.ts")), true);
  assert.equal(fs.existsSync(path.join(REPO, "app", "(app)", "sales-intelligence", "page.tsx")), true);
  assert.equal((PERMISSION_RESOURCES as readonly string[]).includes("ai_insights"), false);
});
