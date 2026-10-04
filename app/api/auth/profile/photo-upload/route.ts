import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { failure } from "@/lib/api";
import { ValidationError } from "@/lib/errors";
import { MAX_PROFILE_PHOTO_BYTES } from "@/lib/profile-photo-validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const response = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        const session = await requireSession();
        const prefix = `profile-photos/${session.organizationId}/${session.userId}/`;
        const filename = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : "";
        if (!/^avatar\.(?:png|jpe?g)$/i.test(filename)) {
          throw new ValidationError("Only PNG, JPG, or JPEG profile photos are allowed.");
        }
        return {
          allowedContentTypes: ["image/png", "image/jpeg"],
          maximumSizeInBytes: MAX_PROFILE_PHOTO_BYTES,
          addRandomSuffix: true,
          allowOverwrite: false,
          validUntil: Date.now() + 15 * 60 * 1000,
          tokenPayload: JSON.stringify({ userId: session.userId, organizationId: session.organizationId }),
        };
      },
    });
    return NextResponse.json(response);
  } catch (error) {
    return failure(error);
  }
}
