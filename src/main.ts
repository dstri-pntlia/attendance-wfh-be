import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { initApp } from './app.setup.js';
import { createAppLogger } from './config/app.config.js';
import { AppConfigService } from './config/app-config.service.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: createAppLogger(process.env.NODE_ENV),
  });
  app.set('trust proxy', 1);
  app.enableShutdownHooks();
  await initApp(app);

  const { port } = app.get(AppConfigService);
  await app.listen(port);
  console.log(`Attendance running on http://localhost:${port}`);
}

await bootstrap();
