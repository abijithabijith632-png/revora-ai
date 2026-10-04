export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
export const PRIVATE_PROFILE_PHOTO_PREFIX = "private-blob:";

export type ProfilePhotoMime = "image/png" | "image/jpeg";

export function detectProfilePhotoMime(bytes: Uint8Array): ProfilePhotoMime | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
    bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a &&
    bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  return null;
}

export function profilePhotoExtensionMatchesMime(
  filename: string,
  mime: ProfilePhotoMime,
): boolean {
  const extension = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return mime === "image/png" ? extension === ".png" : extension === ".jpg" || extension === ".jpeg";
}
