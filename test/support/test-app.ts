import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { initApp } from '../../src/app.setup.js';
import { createAppLogger } from '../../src/config/app.config.js';
import { NodeEnv } from '../../src/config/env.validation.js';
import { StorageService } from '../../src/core/storage/storage.service.js';
import { InMemoryStorage } from './in-memory-storage.js';

export async function createTestApp(
  dataSource: DataSource,
  storage: InMemoryStorage,
): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DataSource)
    .useValue(dataSource)
    .overrideProvider(StorageService)
    .useValue(storage)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bufferLogs: true,
  });
  app.useLogger(createAppLogger(NodeEnv.Test));
  await initApp(app);
  return app;
}
