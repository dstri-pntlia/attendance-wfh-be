import { NotFoundException } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { requestIdMiddleware } from './common/http/request-id.middleware.js';
import { requestLoggerMiddleware } from './common/http/request-logger.middleware.js';
import {
  createCorsOptions,
  createHelmetMiddleware,
} from './common/http/security.js';
import { createValidationPipe } from './common/pipes/validation.pipe.js';
import { API_PREFIX } from './config/app.config.js';
import { AppConfigService } from './config/app-config.service.js';
import { setupSwagger } from './config/swagger.config.js';

export async function initApp(app: NestExpressApplication): Promise<void> {
  const config = app.get(AppConfigService);
  const filter = new AllExceptionsFilter();

  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(createHelmetMiddleware());
  app.use(cookieParser());
  app.enableCors(createCorsOptions(config.frontendOrigins));

  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(filter);
  setupSwagger(app);

  await app.init();

  app.use((req: Request, res: Response) => {
    filter.respond(new NotFoundException(), req, res);
  });
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    filter.respond(err, req, res);
  });
}
