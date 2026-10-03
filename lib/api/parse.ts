import { NextRequest } from "next/server";
import { z } from "zod";
import { idSchema, parseAndValidate } from "@/lib/validation";

/**
 * Parse and validate JSON request body with a Zod schema.
 */
export async function parseBody<S extends z.ZodTypeAny>(
  req: NextRequest,
  schema: S,
): Promise<z.infer<S>> {
  const json = await req.json().catch(() => null);
  return parseAndValidate(schema, json);
}

/**
 * Validate a UUID route parameter before it reaches the service layer.
 * Throws a 400 ValidationError for malformed ids so detail routes never
 * leak raw database errors for non-UUID input.
 */
export async function parsePathId(params: Promise<{ id: string }>): Promise<string> {
  const { id } = await params;
  return parseAndValidate(idSchema, id);
}
