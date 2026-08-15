import { NextRequest, NextResponse } from "next/server";
import { failure } from "@/lib/api";

/**
 * Route handler convention wrapper.
 *
 * Wraps a Next.js route handler so any thrown `AppError` (or unexpected
 * error) is converted into the standard error envelope. Future middleware
 * (auth, tenant, rate-limit) can be composed here as well.
 */
export function withErrorHandling<T>(
  handler: (req: NextRequest, ctx: T) => Promise<NextResponse>,
): (req: NextRequest, ctx: T) => Promise<NextResponse> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      return failure(error);
    }
  };
}
