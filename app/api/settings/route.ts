import { NextRequest } from "next/server";
import { z } from "zod";
import { success, failure, parseBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { OrganizationSettingsService } from "@/server/services/organization-settings";

const updateSettingsSchema = z.object({
  timezone: z.string().trim().max(64).optional(),
  currency: z.string().trim().length(3).optional(),
  dateFormat: z.string().trim().max(32).optional(),
  notificationPreferences: z.record(z.unknown()).optional(),
  brandingPreferences: z.record(z.unknown()).optional(),
  aiPreferences: z.record(z.unknown()).optional(),
  integrationPreferences: z.record(z.unknown()).optional(),
});

export async function GET() {
  try {
    const session = await requireApiContext("settings.view");
    const service = new OrganizationSettingsService(session.organizationId);
    return success(await service.getProfile(), { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireApiContext("settings.edit");
    const input = parseBody(req, updateSettingsSchema);
    const service = new OrganizationSettingsService(session.organizationId);
    const settings = await service.updateSettings({ userId: session.userId }, await input);
    return success(settings, { message: "Settings updated." });
  } catch (error) {
    return failure(error);
  }
}
