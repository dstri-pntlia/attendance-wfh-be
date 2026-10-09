import { createHash, randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service.js';
import type { SavedFile } from './storage.service.js';
import { StorageService } from './storage.service.js';

@Injectable()
export class S3Storage extends StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: AppConfigService) {
    super();
    const { endpoint, bucket, region, accessKeyId, secretAccessKey } =
      config.s3;
    this.bucket = bucket;
    this.client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }

  async save(
    buffer: Buffer,
    mimeType: string,
    prefix?: string,
  ): Promise<SavedFile> {
    const name = `${randomUUID()}.${mimeType.split('/')[1]}`;
    const storageKey = prefix ? `${prefix}/${name}` : name;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: mimeType,
      }),
    );

    return {
      storageKey,
      mimeType,
      sizeBytes: buffer.length,
      sha256: createHash('sha256').update(buffer).digest('hex'),
    };
  }

  async openStream(storageKey: string): Promise<Readable> {
    const result = await this.client
      .send(new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }))
      .catch((error: unknown) => {
        if (isNotFound(error)) throw new NotFoundException();
        throw error;
      });

    if (!result.Body) throw new NotFoundException();
    return result.Body as Readable;
  }

  async delete(storageKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }),
    );
  }
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { name, $metadata } = error as {
    name?: unknown;
    $metadata?: { httpStatusCode?: unknown };
  };
  return name === 'NoSuchKey' || $metadata?.httpStatusCode === 404;
}
