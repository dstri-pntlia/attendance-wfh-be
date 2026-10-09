import { Module } from '@nestjs/common';
import { S3Storage } from './s3.storage.js';
import { StorageService } from './storage.service.js';

@Module({
  providers: [{ provide: StorageService, useClass: S3Storage }],
  exports: [StorageService],
})
export class StorageModule {}
