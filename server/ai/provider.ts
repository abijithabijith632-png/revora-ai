import { serverEnv } from "@/config/env";
import { AppError } from "@/lib/errors";
import type { z } from "zod";

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

export class AiProviderUnavailableError extends AppError {
  constructor() {
    super("SERVICE_UNAVAILABLE", "AI features are unavailable because the AI provider is not configured.");
    this.name = "AiProviderUnavailableError";
  }
}

/**
 * AI provider failure with an actionable message (HTTP error, timeout, or
 * unparsable response). Provider failures are reported as 502 responses.
 */
export class AiProviderError extends AppError {
  constructor(message: string) {
    super("AI_PROVIDER_ERROR", message);
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
        const detail = await res.json().catch(() => null) as {
          error?: { code?: unknown; message?: unknown };
        } | null;
        const providerCode = typeof detail?.error?.code === "string"
          ? detail.error.code.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 80)
          : "";
        console.warn("[ai:provider] Upstream request was rejected.", {
          status: res.status,
          ...(providerCode ? { providerCode } : {}),
        });
        const hint = providerCode === "model_not_found"
          ? "The configured AI_MODEL is unavailable; select a supported model and redeploy."
          : providerCode === "invalid_api_key" || providerCode === "authentication_error"
            ? "Check the server-side AI provider credentials."
            : "Check the AI provider configuration and try again.";
        throw new AiProviderError(
          `AI provider error ${res.status}${providerCode ? ` (${providerCode})` : ""}. ${hint}`,
        );
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        throw new AiProviderError("AI provider returned an empty response.");
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
        err instanceof AiProviderError
      ) {
        throw err;
      }
      if ((err as Error).name === "AbortError") {
        console.warn("[ai:provider] Upstream request timed out.");
        throw new AiProviderError("AI request timed out. Please try again.");
      }
      // Fetch errors can include a configured endpoint URL. Keep details out of
      // client responses; structured status/code details are handled above.
      console.warn("[ai:provider] Upstream connection failed.", {
        errorName: err instanceof Error ? err.name : "UnknownError",
      });
      throw new AiProviderError("AI provider request failed. Check provider connectivity and try again.");
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** Log only safe error metadata when a caller intentionally uses deterministic fallback. */
export function reportAiFallback(feature: string, error: unknown): void {
  const known = error instanceof AppError;
  const name = error instanceof Error ? error.name : "UnknownError";
  console.warn("[ai:fallback] Provider-assisted result unavailable; using the documented deterministic fallback.", {
    feature,
    errorName: name,
    ...(known ? { errorCode: error.code } : {}),
  });
}

/** Validate generated content and map malformed model output as an upstream error. */
export function parseAiResponse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AiProviderError("AI provider returned a response in an unexpected format. Please try again.");
  }
  return result.data;
}

/** Singleton provider instance. */
export const aiProvider = new AiProvider();
