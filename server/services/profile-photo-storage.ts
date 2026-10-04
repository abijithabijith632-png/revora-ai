import { get, head } from "@vercel/blob";
import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  detectProfilePhotoMime,
  MAX_PROFILE_PHOTO_BYTES,
  PRIVATE_PROFILE_PHOTO_PREFIX,
  profilePhotoExtensionMatchesMime,
} from "@/lib/profile-photo-validation";

export { PRIVATE_PROFILE_PHOTO_PREFIX } from "@/lib/profile-photo-validation";

export function isPrivateProfilePhotoReference(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith(PRIVATE_PROFILE_PHOTO_PREFIX));
}

export function profilePhotoPathForOwner(
  reference: string,
  organizationId: string,
  userId: string,
): string {
  if (!isPrivateProfilePhotoReference(reference)) {
    throw new ValidationError("Select a valid profile photo before saving.");
  }
  const pathname = reference.slice(PRIVATE_PROFILE_PHOTO_PREFIX.length);
  const prefix = `profile-photos/${organizationId}/${userId}/`;
  if (!pathname.startsWith(prefix) || pathname.includes("..") || pathname.includes("\\")) {
    throw new NotFoundError("Profile photo not found.");
  }
  const filename = pathname.slice(prefix.length);
  if (!/^avatar(?:-[A-Za-z0-9_-]+)?\.(?:png|jpe?g)$/i.test(filename)) {
    throw new NotFoundError("Profile photo not found.");
  }
  return pathname;
}

export async function validateUploadedProfilePhoto(
  pathname: string,
  organizationId: string,
  userId: string,
): Promise<string> {
  const prefix = `profile-photos/${organizationId}/${userId}/`;
  if (!pathname.startsWith(prefix) || pathname.includes("..") || pathname.includes("\\")) {
    throw new ValidationError("The uploaded photo does not belong to your profile.");
  }
  const filename = pathname.slice(prefix.length);
  if (!/^avatar(?:-[A-Za-z0-9_-]+)?\.(?:png|jpe?g)$/i.test(filename)) {
    throw new ValidationError("Only PNG, JPG, or JPEG profile photos are allowed.");
  }

  try {
    const metadata = await head(pathname);
    if (metadata.size > MAX_PROFILE_PHOTO_BYTES) {
      throw new ValidationError("Profile photos must be 5 MB or smaller.");
    }
    const declaredMime = metadata.contentType;
    if (declaredMime !== "image/png" && declaredMime !== "image/jpeg") {
      throw new ValidationError("Only PNG, JPG, or JPEG profile photos are allowed.");
    }
    if (!profilePhotoExtensionMatchesMime(filename, declaredMime)) {
      throw new ValidationError("The file extension does not match the image type.");
    }

    const stored = await get(pathname, { access: "private", useCache: false });
    if (!stored || stored.statusCode !== 200 || stored.blob.size > MAX_PROFILE_PHOTO_BYTES) {
      throw new ValidationError("Profile photos must be 5 MB or smaller.");
    }
    const bytes = new Uint8Array(await new Response(stored.stream).arrayBuffer());
    const detectedMime = detectProfilePhotoMime(bytes);
    if (!detectedMime || detectedMime !== declaredMime) {
      throw new ValidationError("The uploaded file is not a valid PNG, JPG, or JPEG image.");
    }
    return `${PRIVATE_PROFILE_PHOTO_PREFIX}${pathname}`;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError("The uploaded profile photo could not be verified.");
  }
}
