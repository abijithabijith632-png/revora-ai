import { NextRequest } from "next/server";
import { z } from "zod";
import { parseAndValidate } from "@/lib/validation";

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
