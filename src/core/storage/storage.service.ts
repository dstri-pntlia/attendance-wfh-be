import type { Readable } from 'node:stream';

export interface SavedFile {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}

export abstract class StorageService {
  abstract save(
    buffer: Buffer,
    mimeType: string,
    prefix?: string,
  ): Promise<SavedFile>;
  abstract openStream(storageKey: string): Promise<Readable>;
  abstract delete(storageKey: string): Promise<void>;
}
