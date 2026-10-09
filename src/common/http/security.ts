import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import helmet from 'helmet';
import { REQUEST_ID_HEADER } from './request-id.middleware.js';

export const SWAGGER_PATH = 'api/docs';
export const SWAGGER_JSON_PATH = 'api/docs-json';

export function createCorsOptions(
  allowedOrigins: readonly string[],
): CorsOptions {
  return {
    origin: (origin, callback) => {
      callback(null, origin === undefined || allowedOrigins.includes(origin));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', REQUEST_ID_HEADER],
    exposedHeaders: [REQUEST_ID_HEADER, 'Location'],
    maxAge: 600,
  };
}

export function createHelmetMiddleware(): RequestHandler {
  const apiHelmet = helmet();
  const docsHelmet = helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  });
  const docsPrefix = `/${SWAGGER_PATH}`;

  return (req: Request, res: Response, next: NextFunction) => {
    const isDocs =
      req.path === docsPrefix || req.path.startsWith(`${docsPrefix}/`);
    return (isDocs ? docsHelmet : apiHelmet)(req, res, next);
  };
}
