import { NextResponse } from "next/server";
import {
  AppError,
  isAppError,
  DatabaseError,
} from "@/lib/errors";
import { serverEnv } from "@/config/env";

/**
 * Standard API response envelopes.
 *
 * Success:  { success: true,  data, message, meta }
 * Error:    { success: false, error: { code, message, details } }
 */

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  [key: string]: unknown;
}

export function success<T>(
  data: T,
  options?: { message?: string; meta?: ApiMeta; status?: number },
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      message: options?.message ?? "OK",
      meta: options?.meta ?? {},
    },
    { status: options?.status ?? 200 },
  );
}

export function failure(
  error: unknown,
  options?: { log?: boolean },
): NextResponse {
  const appError: AppError = isAppError(error)
    ? error
    : new DatabaseError("An unexpected error occurred.", error);

  if (options?.log !== false) {
    // Structured server-side logging without leaking secrets in the response.
    console.error(`[api:error] ${appError.code}`, {
      message: appError.message,
      // Only include details when explicitly safe/expected.
      ...(appError.details !== undefined ? { details: appError.details } : {}),
      ...(!serverEnv.isProduction && appError.cause
        ? { cause: String(appError.cause) }
        : {}),
    });
  }

  const body = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details !== undefined ? { details: appError.details } : {}),
    },
  };

  return NextResponse.json(body, { status: appError.status });
}

/**
 * Error envelope shape shared across the client/server boundary.
 */
export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
