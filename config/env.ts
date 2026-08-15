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
 */

const requiredString = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

/**
 * Server-only environment variables.
 *
 * @deprecated never import from a client component — it will surface runtime
 * errors in the browser by design, preventing accidental secret leakage.
 */
export const serverEnv = {
  /** PostgreSQL connection string. Never expose to the client. */
  databaseUrl: requiredString("DATABASE_URL", process.env.DATABASE_URL),
  /** Runtime environment. */
  nodeEnv: process.env.NODE_ENV ?? "development",
  /** Canonical application URL for server-side usage. */
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  /** True when running in production. */
  isProduction: process.env.NODE_ENV === "production",
  /**
   * Secret used to derive password-hash pepper and (if desired) sign values.
   * Never expose to the client.
   */
  authSecret: requiredString("AUTH_SECRET", process.env.AUTH_SECRET),
  /** Session lifetime in seconds (default 7 days). */
  sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS ?? 60 * 60 * 24 * 7),
  /**
   * AI provider configuration (server-only). Never expose the key to the
   * client or return it through an API response.
   */
  aiProvider: process.env.AI_PROVIDER ?? "groq",
  aiApiKey: process.env.AI_PROVIDER_API_KEY ?? "",
  aiModel: process.env.AI_MODEL ?? "llama-3.3-70b-versatile",
  aiBaseUrl:
    process.env.AI_BASE_URL ?? "https://api.groq.com/openai/v1",
  /** Email provider credentials (server-only). Empty = not configured. */
  emailProvider: process.env.EMAIL_PROVIDER ?? "",
  emailProviderApiKey: process.env.EMAIL_PROVIDER_API_KEY ?? "",
  /** Payment provider credentials (server-only). Empty = not configured. */
  paymentProvider: process.env.PAYMENT_PROVIDER ?? "",
  paymentProviderApiKey: process.env.PAYMENT_PROVIDER_API_KEY ?? "",
} as const;

/**
 * Public environment variables — safe for client usage.
 * Only `NEXT_PUBLIC_*` values may appear here.
 */
export const publicEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Revora AI",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;
