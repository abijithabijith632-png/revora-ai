import { success, failure } from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { ContactService } from "@/server/services/contacts";

export async function GET() {
  try {
    const session = await requireApiContext("contacts.view");
    const data = await new ContactService(session.organizationId).dataQuality();
    return success(data, { message: "Contact data quality reviewed." });
  } catch (error) { return failure(error); }
}
