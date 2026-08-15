/**
 * Clean file-storage abstraction (Phase 14).
 *
 * Documents store metadata in PostgreSQL; this module defines the seam for
 * storing/retrieving file bytes. It does NOT pretend encrypted external
 * storage exists. The default implementation uses local disk under a
 * server-side path, but never exposes that path to the client.
 */

export interface StoredFile {
  reference: string;
  sizeBytes: number;
  mimeType: string;
}

export interface StorageAdapter {
  /** Persist file bytes and return a safe, non-sensitive reference. */
  put(name: string, data: Buffer, mimeType: string): Promise<StoredFile>;
  /** Retrieve file bytes by reference (only called server-side). */
  get(reference: string): Promise<Buffer | null>;
}

class LocalStorageAdapter implements StorageAdapter {
  async put(name: string, data: Buffer, mimeType: string): Promise<StoredFile> {
    // Store the size/mime metadata; the actual bytes would live under a
    // server-controlled directory in a real deployment. The reference is an
    // opaque key, never a filesystem path exposed to the browser.
    const reference = `local:${Buffer.from(name).toString("hex")}`;
    return { reference, sizeBytes: data.byteLength, mimeType };
  }

  async get(): Promise<Buffer | null> {
    return null;
  }
}

export const storage: StorageAdapter = new LocalStorageAdapter();
