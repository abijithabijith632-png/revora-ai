import { and, eq } from "drizzle-orm";
import { get } from "@vercel/blob";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { NotFoundError } from "@/lib/errors";
import { failure } from "@/lib/api";
import { isPrivateProfilePhotoReference, profilePhotoPathForOwner } from "@/server/services/profile-photo-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();
    const [user] = await db.select({ avatarUrl: users.avatarUrl })
      .from(users)
      .where(and(eq(users.id, session.userId), eq(users.organizationId, session.organizationId)))
      .limit(1);
    if (!user || !isPrivateProfilePhotoReference(user.avatarUrl)) throw new NotFoundError("Profile photo not found.");

    const pathname = profilePhotoPathForOwner(user.avatarUrl!, session.organizationId, session.userId);
    const blob = await get(pathname, { access: "private" });
    if (!blob || blob.statusCode !== 200) throw new NotFoundError("Profile photo not found.");
    return new Response(blob.stream, {
      headers: {
        "Content-Type": blob.blob.contentType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
    }
    return failure(error);
  }
}
