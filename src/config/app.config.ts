import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import { NodeEnv } from './env.validation.js';

export const API_PREFIX = 'api/v1';

const LOG_LEVELS: Record<NodeEnv, LogLevel[]> = {
  [NodeEnv.Development]: ['fatal', 'error', 'warn', 'log', 'debug'],
  [NodeEnv.Production]: ['fatal', 'error', 'warn', 'log'],
  [NodeEnv.Test]: [],
};

const REDACTED_KEYS = [
  'password',
  'currentPassword',
  'newPassword',
  'passwordHash',
  'accessToken',
  'refreshToken',
  'token',
  'authorization',
  'cookie',
];

export function createAppLogger(nodeEnv: string | undefined): ConsoleLogger {
  return new ConsoleLogger({
    json: false,
    colors: true,
    flattenParams: true,
    logLevels:
      LOG_LEVELS[nodeEnv as NodeEnv] ?? LOG_LEVELS[NodeEnv.Development],
    redact: REDACTED_KEYS,
  });
}
