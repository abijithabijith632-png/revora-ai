import "dotenv/config";
import { aiProvider } from "@/server/ai/provider";

async function main() {
  console.log("[ai-provider-check] model:", aiProvider.model, "configured:", aiProvider.isConfigured);

  const raw = await aiProvider.generateStructured({
    system: "You are a lead scoring engine. Return JSON only.",
    user: 'Return JSON: {"score":42,"level":"MEDIUM"}',
    jsonMode: true,
  });

  console.log("[ai-provider-check] RAW:", JSON.stringify(raw));
}

main().catch((err) => {
  console.error("[ai-provider-check] FAILED:", err.message);
  process.exitCode = 1;
});
