import { success, failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { AssignmentService } from "@/server/services/assignment";

export async function GET() {
  try {
    const session = await requireApiContext("leads.assign");
    const service = new AssignmentService(session.organizationId);
    const telemetry = await service.telemetry();

    return success(telemetry, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}
