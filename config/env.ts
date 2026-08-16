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
 * IMPORTANT: `serverEnv` values are resolved lazily (on property access) rather
 * than eagerly at module load. This lets static pages such as `/_not-found`
 * import `publicEnv` from this module during `next build` without requiring
 * `DATABASE_URL`/`AUTH_SECRET` to be present at build time. Server code that
 * actually uses a secret will still receive a clear runtime error if it is
 * missing.
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

function resolveServerEnv(): ServerEnv {
  return {
    databaseUrl: requiredString("DATABASE_URL", process.env.DATABASE_URL),
    nodeEnv: process.env.NODE_ENV ?? "development",
    appUrl: process.env.APP_URL ?? "http://localhost:3000",
    isProduction: process.env.NODE_ENV === "production",
    authSecret: requiredString("AUTH_SECRET", process.env.AUTH_SECRET),
    sessionTtlSeconds: Number(
      process.env.SESSION_TTL_SECONDS ?? 60 * 60 * 24 * 7,
    ),
    aiProvider: process.env.AI_PROVIDER ?? "groq",
    aiApiKey: process.env.AI_PROVIDER_API_KEY ?? "",
    aiModel: process.env.AI_MODEL ?? "llama-3.3-70b-versatile",
    aiBaseUrl: process.env.AI_BASE_URL ?? "https://api.groq.com/openai/v1",
    emailProvider: process.env.EMAIL_PROVIDER ?? "",
    emailProviderApiKey: process.env.EMAIL_PROVIDER_API_KEY ?? "",
    paymentProvider: process.env.PAYMENT_PROVIDER ?? "",
    paymentProviderApiKey: process.env.PAYMENT_PROVIDER_API_KEY ?? "",
  };
}

/**
 * Server-only environment variables.
 *
 * @deprecated never import from a client component — it will surface runtime
 * errors in the browser by design, preventing accidental secret leakage.
 *
 * Values are resolved lazily so that merely importing this module (e.g. to
 * read `publicEnv`) does not require secrets to be configured.
 */
export const serverEnv = new Proxy({} as ServerEnv, {
  get(_target, prop: keyof ServerEnv) {
    return resolveServerEnv()[prop];
  },
});

/**
 * Public environment variables — safe for client usage.
 * Only `NEXT_PUBLIC_*` values may appear here.
 */
export const publicEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Revora AI",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;
