import { NextRequest } from "next/server";
import { z } from "zod";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { OrganizationSettingsService } from "@/server/services/organization-settings";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(10_000).nullable().optional(),
  website: z.string().trim().url().max(255).nullable().optional(),
  industry: z.string().trim().max(128).nullable().optional(),
  contactEmail: z.string().trim().email().max(320).nullable().optional(),
  contactPhone: z.string().trim().max(32).nullable().optional(),
  address: z.string().trim().max(5_000).nullable().optional(),
  logoUrl: z.string().trim().max(255).nullable().optional(),
  timezone: z.string().trim().max(64).optional(),
  currency: z.string().trim().length(3).optional(),
});

export async function GET() {
  try {
    const session = await requireApiContext("organization.view");
    const service = new OrganizationSettingsService(session.organizationId);
    return success(await service.getProfile(), { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireApiContext("organization.edit");
    const input = parseBody(req, updateSchema);
    const service = new OrganizationSettingsService(session.organizationId);
    const profile = await service.updateProfile({ userId: session.userId }, await input);
    return success(profile, { message: "Organization updated." });
  } catch (error) {
    return failure(error);
  }
}
