import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  type SavedFile,
  StorageService,
} from '../../src/core/storage/storage.service.js';

export class InMemoryStorage extends StorageService {
  readonly files = new Map<string, Buffer>();

  save(buffer: Buffer, mimeType: string): Promise<SavedFile> {
    const storageKey = `${randomUUID()}.${mimeType.split('/')[1]}`;
    this.files.set(storageKey, buffer);
    return Promise.resolve({
      storageKey,
      mimeType,
      sizeBytes: buffer.length,
      sha256: createHash('sha256').update(buffer).digest('hex'),
    });
  }

  openStream(storageKey: string): Promise<Readable> {
    const file = this.files.get(storageKey);
    if (!file) return Promise.reject(new Error(`missing ${storageKey}`));
    return Promise.resolve(Readable.from(file));
  }

  delete(storageKey: string): Promise<void> {
    this.files.delete(storageKey);
    return Promise.resolve();
  }
}
