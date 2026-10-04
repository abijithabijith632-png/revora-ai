/**
 * Environment configuration access.
 *
 * This module enforces the server/client boundary for environment variables:
 * - `serverEnv` must ONLY be imported from server-side code (route handlers,
 *   server components, server services, scripts).
 * - `publicEnv` is safe to import anywhere and only exposes `NEXT_PUBLIC_*`
 *   variables that are intentionally sent to the browser.
 *
 * Secrets (DATABASE_URL, tokens, keys) must NEVER be referenced by client code.
 *
 * IMPORTANT: every `serverEnv` property is resolved independently and lazily
 * (via getters) rather than eagerly at module load. This allows static pages
 * such as `/_not-found` to import `publicEnv` from this module — and allows
 * modules that only read non-secret fields (e.g. `sessionTtlSeconds`) — during
 * `next build` without requiring `DATABASE_URL`/`AUTH_SECRET` to be present.
 * Only the specific property that is actually accessed is validated.
 */

import { ConfigurationError } from "@/lib/errors";

const AI_DEFAULT_MODEL = "openai/gpt-oss-120b";
const DEPRECATED_AI_MODELS = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
]);

const requiredString = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new ConfigurationError(
      `Server configuration is incomplete: set ${name} and redeploy.`,
    );
  }
  return value;
};

/**
 * Normalizes a Postgres connection string so stray whitespace can never corrupt
 * the parsed components (e.g. `database "postgres " does not exist`).
 *
 * Connection strings are often pasted from dashboards into env config, and a
 * trailing space (or a space before `?query` params) makes the driver resolve a
 * database name that includes the whitespace. URLs never legitimately contain
 * whitespace, so trimming the value and removing spaces adjacent to the query
 * delimiter is always safe.
 */
const normalizeDatabaseUrl = (value: string): string =>
  value
    .trim()
    .replace(/\s+\?/g, "?")
    .replace(/\?\s+/g, "?")
    .replace(/\/\s+/g, "/");

interface ServerEnv {
  /** PostgreSQL connection string. Never expose to the client. */
  databaseUrl: string;
  /** Runtime environment. */
  nodeEnv: string;
  /** Canonical application URL for server-side usage. */
  appUrl: string;
  /** True when running in production. */
  isProduction: boolean;
  /** Secret used to derive password-hash pepper and (if desired) sign values. */
  authSecret: string;
  /** Session lifetime in seconds (default 7 days). */
  sessionTtlSeconds: number;
  /** AI provider configuration (server-only). */
  aiProvider: string;
  aiApiKey: string;
  aiModel: string;
  aiBaseUrl: string;
  /** Email provider credentials (server-only). Empty = not configured. */
  emailProvider: string;
  emailProviderApiKey: string;
  /** Payment provider credentials (server-only). Empty = not configured. */
  paymentProvider: string;
  paymentProviderApiKey: string;
}

/**
 * Server-only environment variables.
 *
 * @deprecated never import from a client component — it will surface runtime
 * errors in the browser by design, preventing accidental secret leakage.
 *
 * Each property is a getter, so accessing one value never forces resolution of
 * the others. This keeps static builds working while still failing loudly for
 * server code that genuinely needs an unset secret.
 */
export const serverEnv: ServerEnv = {
  get databaseUrl() {
    const databaseUrl = normalizeDatabaseUrl(
      requiredString("DATABASE_URL", process.env.DATABASE_URL),
    );
    try {
      const url = new URL(databaseUrl);
      if (!url.protocol.startsWith("postgres")) throw new Error("not Postgres");
    } catch (cause) {
      throw new ConfigurationError(
        "Server configuration is invalid: DATABASE_URL must be a PostgreSQL connection URL.",
        cause,
      );
    }
    return databaseUrl;
  },
  get nodeEnv() {
    return process.env.NODE_ENV ?? "development";
  },
  get appUrl() {
    return process.env.APP_URL ?? "http://localhost:3000";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get authSecret() {
    return requiredString("AUTH_SECRET", process.env.AUTH_SECRET);
  },
  get sessionTtlSeconds() {
    const value = Number(process.env.SESSION_TTL_SECONDS ?? 60 * 60 * 24 * 7);
    if (!Number.isFinite(value) || value <= 0) {
      throw new ConfigurationError(
        "Server configuration is invalid: SESSION_TTL_SECONDS must be a positive number.",
      );
    }
    return value;
  },
  get aiProvider() {
    return process.env.AI_PROVIDER ?? "groq";
  },
  get aiApiKey() {
    return process.env.AI_PROVIDER_API_KEY ?? "";
  },
  get aiModel() {
    const configured = process.env.AI_MODEL?.trim();
    if (!configured) return AI_DEFAULT_MODEL;
    if (DEPRECATED_AI_MODELS.has(configured) || configured.startsWith("llama3-")) {
      if (process.env.NODE_ENV !== "test") {
        console.warn("[ai:config] Ignoring a deprecated AI_MODEL; using the configured current default.", {
          configuredModel: configured,
          effectiveModel: AI_DEFAULT_MODEL,
        });
      }
      return AI_DEFAULT_MODEL;
    }
    return configured;
  },
  get aiBaseUrl() {
    return process.env.AI_BASE_URL ?? "https://api.groq.com/openai/v1";
  },
  get emailProvider() {
    return process.env.EMAIL_PROVIDER ?? "";
  },
  get emailProviderApiKey() {
    return process.env.EMAIL_PROVIDER_API_KEY ?? "";
  },
  get paymentProvider() {
    return process.env.PAYMENT_PROVIDER ?? "";
  },
  get paymentProviderApiKey() {
    return process.env.PAYMENT_PROVIDER_API_KEY ?? "";
  },
};

/**
 * Public environment variables — safe for client usage.
 * Only `NEXT_PUBLIC_*` values may appear here.
 */
export const publicEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "SHE Software Solutions",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;
