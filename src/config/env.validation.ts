import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateBy,
  validateSync,
  ValidationError,
} from 'class-validator';
import {
  isValidTimeZone,
  WORK_START_TIME_PATTERN,
} from '../common/utils/time.util.js';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export enum CookieSameSite {
  Lax = 'lax',
  None = 'none',
  Strict = 'strict',
}

export const DATABASE_URL_PATTERN = /^postgres(ql)?:\/\/\S+$/;

export const MAX_UPLOAD_BYTES = 5_242_880;

function toBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

function toList({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function isOrigin(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.origin === value
    );
  } catch {
    return false;
  }
}

function IsOriginList(): PropertyDecorator {
  return ValidateBy({
    name: 'isOriginList',
    validator: {
      validate: (value: unknown) =>
        Array.isArray(value) && value.every(isOrigin),
      defaultMessage: () =>
        '$property must be a comma-separated list of origins such as http://localhost:5173 (scheme, host and optional port; no path or trailing slash)',
    },
  });
}

function IsTimeZone(): PropertyDecorator {
  return ValidateBy({
    name: 'isTimeZone',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' && isValidTimeZone(value),
      defaultMessage: () => '$property must be a valid IANA time zone',
    },
  });
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 8080;

  @IsString()
  @Matches(DATABASE_URL_PATTERN, {
    message: 'DATABASE_URL must be a postgres:// or postgresql:// URL',
  })
  DATABASE_URL: string;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  @IsString()
  @Matches(/^\d+[smhd]$/, {
    message: 'JWT_ACCESS_TTL must be a duration such as 900s, 15m, 8h or 1d',
  })
  JWT_ACCESS_TTL = '15m';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  REFRESH_TOKEN_TTL_DAYS = 7;

  @Transform(toList)
  @IsArray()
  @ArrayNotEmpty()
  @IsOriginList()
  FRONTEND_ORIGIN: string[];

  @IsString()
  @Matches(/^https:\/\/\S+$/, {
    message: 'S3_ENDPOINT must be an https:// URL',
  })
  S3_ENDPOINT: string;

  @IsString()
  @IsNotEmpty()
  S3_BUCKET: string;

  @IsString()
  @IsNotEmpty()
  S3_ACCESS_KEY_ID: string;

  @IsString()
  @IsNotEmpty()
  S3_SECRET_ACCESS_KEY: string;

  @IsString()
  @IsNotEmpty()
  S3_REGION = 'auto';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES)
  UPLOAD_MAX_BYTES = MAX_UPLOAD_BYTES;

  @IsTimeZone()
  APP_TIMEZONE = 'Asia/Jakarta';

  @Matches(WORK_START_TIME_PATTERN, {
    message: 'WORK_START_TIME must be HH:mm (24-hour)',
  })
  WORK_START_TIME = '09:00';

  @Transform(toBoolean)
  @IsBoolean({ message: 'COOKIE_SECURE must be "true" or "false"' })
  COOKIE_SECURE = false;

  @Transform(toBoolean)
  @IsBoolean({ message: 'SEED_ON_START must be "true" or "false"' })
  SEED_ON_START = false;
}

function formatErrors(errors: ValidationError[]): string {
  return errors
    .map(
      (error) =>
        `  - ${Object.values(error.constraints ?? {}).join('; ') || error.property}`,
    )
    .join('\n');
}

export function validateEnv(
  raw: Record<string, unknown>,
): EnvironmentVariables {
  const present = Object.fromEntries(
    Object.entries(raw).filter(
      ([, value]) => value !== undefined && value !== '',
    ),
  );
  const config = plainToInstance(EnvironmentVariables, present);
  const errors = validateSync(config, {
    validationError: { target: false, value: false },
  });
  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${formatErrors(errors)}`,
    );
  }
  return config;
}
