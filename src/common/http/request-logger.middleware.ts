import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startedAt = performance.now();

  res.on('finish', () => {
    const entry = {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      statusCode: res.statusCode,
      durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
      ...(req.user && { userId: req.user.id }),
    };
    if (res.statusCode >= 500) logger.error('request failed', entry);
    else if (res.statusCode >= 400) logger.warn('request rejected', entry);
    else logger.log('request completed', entry);
  });

  next();
}
