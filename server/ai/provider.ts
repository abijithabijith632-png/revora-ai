import { serverEnv } from "@/config/env";
import { ValidationError } from "@/lib/errors";

/**
 * Server-only OpenAI-compatible AI provider client (Groq by default).
 * The API key NEVER leaves the server. This module must never be imported
 * from a client component.
 */

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StructuredAiRequest {
  system: string;
  user: string;
  /** Instruct the provider to return a JSON object. */
  jsonMode?: boolean;
}

export class AiProviderUnavailableError extends Error {
  constructor() {
    super("AI provider not configured.");
    this.name = "AiProviderUnavailableError";
  }
}

const TIMEOUT_MS = 25_000;

export class AiProvider {
  constructor(
    private readonly config = {
      baseUrl: serverEnv.aiBaseUrl,
      apiKey: serverEnv.aiApiKey,
      model: serverEnv.aiModel,
    },
  ) {}

  get isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  get model(): string {
    return this.config.model;
  }

  async generateStructured(
    req: StructuredAiRequest,
  ): Promise<Record<string, unknown>> {
    if (!this.isConfigured) {
      throw new AiProviderUnavailableError();
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(
        `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: [
              { role: "system", content: req.system },
              { role: "user", content: req.user },
            ],
            temperature: 0.1,
            response_format: req.jsonMode
              ? { type: "json_object" }
              : undefined,
          }),
          signal: controller.signal,
        },
      );

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(
          `AI provider error ${res.status}: ${detail.slice(0, 300)}`,
        );
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        throw new ValidationError("AI provider returned an empty response.");
      }

      const parsed = JSON.parse(content);
      if (typeof parsed !== "object" || parsed === null) {
        throw new ValidationError("AI provider returned invalid JSON.");
      }

      return parsed as Record<string, unknown>;
    } catch (err) {
      if (err instanceof AiProviderUnavailableError) throw err;
      if ((err as Error).name === "AbortError") {
        throw new Error("AI scoring timed out. Please try again.");
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** Singleton provider instance. */
export const aiProvider = new AiProvider();
