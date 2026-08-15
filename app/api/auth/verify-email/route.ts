import { success, failure } from "@/lib/api";
import { verifyEmail } from "@/lib/auth";
import { z } from "zod";
import { parseAndValidate } from "@/lib/validation";

const schema = z.object({ token: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const { token } = await req
      .json()
      .then((b) => parseAndValidate(schema, b));
    await verifyEmail(token);
    return success(null, { message: "Email verified." });
  } catch (error) {
    return failure(error);
  }
}
