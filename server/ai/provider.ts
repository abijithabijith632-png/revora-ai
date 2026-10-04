import { serverEnv } from "@/config/env";
import { AppError, ConfigurationError, ValidationError } from "@/lib/errors";

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

export class AiProviderUnavailableError extends ConfigurationError {
  constructor() {
    super("AI features are unavailable because the AI provider is not configured.");
    this.name = "AiProviderUnavailableError";
  }
}

/**
 * AI provider failure with an actionable message (HTTP error, timeout, or
 * unparsable response). Surfaced as INTERNAL_ERROR so callers return a
 * meaningful 500 instead of "An unexpected error occurred."
 */
export class AiProviderError extends AppError {
  constructor(message: string) {
    super("INTERNAL_ERROR", message);
    this.name = "AiProviderError";
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
        throw new AiProviderError(
          `AI provider error ${res.status}: ${detail.slice(0, 300) || res.statusText}`,
        );
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        throw new ValidationError("AI provider returned an empty response.");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new AiProviderError(
          "AI provider returned invalid JSON. Please try again.",
        );
      }
      if (typeof parsed !== "object" || parsed === null) {
        throw new AiProviderError(
          "AI provider returned invalid JSON. Please try again.",
        );
      }

      return parsed as Record<string, unknown>;
    } catch (err) {
      if (
        err instanceof AiProviderUnavailableError ||
        err instanceof AiProviderError ||
        err instanceof ValidationError
      ) {
        throw err;
      }
      if ((err as Error).name === "AbortError") {
        throw new AiProviderError("AI request timed out. Please try again.");
      }
      throw new AiProviderError(
        `AI provider request failed: ${(err as Error).message?.slice(0, 300) ?? "unknown error"}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** Singleton provider instance. */
export const aiProvider = new AiProvider();
