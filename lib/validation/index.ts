import { z } from "zod";
import { ValidationError } from "@/lib/errors";

/**
 * Validation foundation — shared Zod schemas are consumed by both server
 * route handlers and client forms to guarantee a single source of truth.
 */

/**
 * Parse and validate unknown input with a Zod schema.
 * Throws a `ValidationError` (mapped to 400) on failure.
 */
export function parseAndValidate<S extends z.ZodTypeAny>(
  schema: S,
  input: unknown,
): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(
      "The request contains invalid data.",
      result.error.flatten().fieldErrors,
    );
  }
  return result.data as z.infer<S>;
}

/**
 * Core shared schemas used across future domains.
 * These establish naming conventions (UUID strings, ISO timestamps, slugs).
 */
export const idSchema = z.string().uuid("Invalid identifier format.");

export const timestampSchema = z.string().datetime();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;
