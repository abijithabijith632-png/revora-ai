/**
 * Centralized error handling foundation.
 *
 * Each error maps to a stable `code` and an appropriate HTTP status.
 * Route handlers and server services throw these; the API layer converts
 * them into the standard error envelope. Never expose stack traces or
 * secrets in production responses.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DATABASE_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  DATABASE_ERROR: 500,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

/**
 * Base application error. Extend for specific cases.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /** Optional structured details (safe to return to the client). */
  readonly details?: unknown;
  /** Optional internal cause — never serialized to the client. */
  readonly cause?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { details?: unknown; cause?: unknown },
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = options?.details;
    this.cause = options?.cause;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super("VALIDATION_ERROR", message, { details });
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required.") {
    super("UNAUTHORIZED", message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super("FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found.") {
    super("NOT_FOUND", message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "The request conflicts with an existing resource.") {
    super("CONFLICT", message);
    this.name = "ConflictError";
  }
}

export class DatabaseError extends AppError {
  constructor(message = "A database error occurred.", cause?: unknown) {
    super("DATABASE_ERROR", message, { cause });
    this.name = "DatabaseError";
  }
}

export class RateLimitedError extends AppError {
  constructor(message = "Too many requests. Please try again later.") {
    super("RATE_LIMITED", message);
    this.name = "RateLimitedError";
  }
}

/** Type guard for narrowing unknown errors. */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
