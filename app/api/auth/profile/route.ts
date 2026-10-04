import { and, eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { success, failure } from "@/lib/api";
import { parseBody } from "@/lib/api/parse";
import { requireSession, updateProfile, updateProfileSchema } from "@/lib/auth";
import { ValidationError } from "@/lib/errors";
import {
  isPrivateProfilePhotoReference,
  profilePhotoPathForOwner,
  validateUploadedProfilePhoto,
} from "@/server/services/profile-photo-storage";

export async function GET() {
  try {
    const session = await requireSession();
    return success(session, { message: "OK" });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(req: NextRequest) {
  let candidatePhotoPath: string | null = null;
  let profileSaved = false;
  try {
    const session = await requireSession();
    const input = await parseBody(req, updateProfileSchema);
    if (input.avatarUrl && isPrivateProfilePhotoReference(input.avatarUrl)) {
      const requestedPath = input.avatarUrl.slice("private-blob:".length);
      candidatePhotoPath = profilePhotoPathForOwner(
        input.avatarUrl,
        session.organizationId,
        session.userId,
      );
      const verifiedReference = await validateUploadedProfilePhoto(
        requestedPath,
        session.organizationId,
        session.userId,
      );
      input.avatarUrl = verifiedReference;
    } else if (input.avatarUrl) {
      throw new ValidationError("Profile photos must be uploaded as PNG, JPG, or JPEG files.");
    }

    const [currentUser] = await db
      .select({ avatarUrl: users.avatarUrl })
      .from(users)
      .where(and(eq(users.id, session.userId), eq(users.organizationId, session.organizationId)))
      .limit(1);
    const updated = await updateProfile(session.userId, session.organizationId, input);
    profileSaved = true;

    const oldReference = currentUser?.avatarUrl;
    if (
      input.avatarUrl !== undefined &&
      oldReference && oldReference !== updated.avatarUrl &&
      isPrivateProfilePhotoReference(oldReference)
    ) {
      try {
        await del(profilePhotoPathForOwner(oldReference, session.organizationId, session.userId));
      } catch {
        // Profile persistence must succeed even if an old object cannot be cleaned up.
      }
    }
    return success(updated, { message: "Profile updated." });
  } catch (error) {
    return failure(error);
  } finally {
    if (!profileSaved && candidatePhotoPath) {
      try {
        await del(candidatePhotoPath);
      } catch {
        // Failed profile saves may leave an orphan; cleanup is best effort.
      }
    }
  }
}
