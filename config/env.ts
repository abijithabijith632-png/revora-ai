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

const requiredString = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

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
    return requiredString("DATABASE_URL", process.env.DATABASE_URL);
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
    return Number(process.env.SESSION_TTL_SECONDS ?? 60 * 60 * 24 * 7);
  },
  get aiProvider() {
    return process.env.AI_PROVIDER ?? "groq";
  },
  get aiApiKey() {
    return process.env.AI_PROVIDER_API_KEY ?? "";
  },
  get aiModel() {
    return process.env.AI_MODEL ?? "llama-3.3-70b-versatile";
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
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Revora AI",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;
