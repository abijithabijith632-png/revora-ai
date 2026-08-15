import { NextRequest } from "next/server";
import {
  success,
  failure,
  parseBody,
  parsePagination,
  buildPaginationMeta,
} from "@/lib/api";
import { requireApiContext } from "@/lib/api/context";
import { EmailService } from "@/server/services/emails";
import { z } from "zod";

const emailRecordSchema = z.object({
  direction: z.enum(["inbound", "outbound"]),
  recipient: z.string().max(320).optional(),
  subject: z.string().max(255).optional(),
  body: z.string().optional(),
  messageId: z.string().max(512).optional(),
  threadId: z.string().max(512).optional(),
  recipients: z.array(z.string()).optional(),
  attachments: z.array(z.record(z.unknown())).optional(),
  clientId: z.string().uuid().nullish(),
  opportunityId: z.string().uuid().nullish(),
  leadId: z.string().uuid().nullish(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiContext("proposals.view");
    const pagination = parsePagination(req.nextUrl);

    const service = new EmailService(session.organizationId);
    const { rows, total } = await service.list(pagination);

    return success(rows, {
      message: "OK",
      meta: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages: buildPaginationMeta(total, pagination).totalPages,
      },
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireApiContext("proposals.create");
    const input = await parseBody(req, emailRecordSchema);

    const service = new EmailService(session.organizationId);
    const email = await service.record({ userId: session.userId }, {
      direction: input.direction,
      recipient: input.recipient ?? null,
      subject: input.subject ?? null,
      body: input.body ?? null,
      messageId: input.messageId ?? null,
      threadId: input.threadId ?? null,
      recipients: input.recipients ?? null,
      attachments: input.attachments ?? null,
      clientId: input.clientId ?? null,
      opportunityId: input.opportunityId ?? null,
      leadId: input.leadId ?? null,
    });

    return success(email, { message: "Email recorded.", status: 201 });
  } catch (error) {
    return failure(error);
  }
}
