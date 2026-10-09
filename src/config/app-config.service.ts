import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ttlToSeconds } from '../common/utils/duration.util.js';
import { EnvironmentVariables, NodeEnv } from './env.validation.js';

const REFRESH_KEY_CONTEXT = 'dexa-wfh-attendance:refresh-token:v1';

@Injectable()
export class AppConfigService {
  private refreshSecret: string | undefined;

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  private get<K extends keyof EnvironmentVariables>(
    key: K,
  ): EnvironmentVariables[K] {
    return this.config.get(key, { infer: true });
  }

  get nodeEnv(): NodeEnv {
    return this.get('NODE_ENV');
  }

  get port(): number {
    return this.get('PORT');
  }

  get databaseUrl(): string {
    return this.get('DATABASE_URL');
  }

  get jwtAccessSecret(): string {
    return this.get('JWT_ACCESS_SECRET');
  }

  get jwtAccessTtl(): string {
    return this.get('JWT_ACCESS_TTL');
  }

  get jwtAccessTtlSeconds(): number {
    return ttlToSeconds(this.jwtAccessTtl);
  }

  get jwtRefreshSecret(): string {
    this.refreshSecret ??= createHmac('sha256', this.jwtAccessSecret)
      .update(REFRESH_KEY_CONTEXT)
      .digest('hex');
    return this.refreshSecret;
  }

  get refreshTokenTtlDays(): number {
    return this.get('REFRESH_TOKEN_TTL_DAYS');
  }

  get refreshTokenTtlSeconds(): number {
    return this.refreshTokenTtlDays * 86_400;
  }

  get frontendOrigins(): string[] {
    return this.get('FRONTEND_ORIGIN');
  }

  get s3(): {
    endpoint: string;
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  } {
    return {
      endpoint: this.get('S3_ENDPOINT'),
      bucket: this.get('S3_BUCKET'),
      region: this.get('S3_REGION'),
      accessKeyId: this.get('S3_ACCESS_KEY_ID'),
      secretAccessKey: this.get('S3_SECRET_ACCESS_KEY'),
    };
  }

  get uploadMaxBytes(): number {
    return this.get('UPLOAD_MAX_BYTES');
  }

  get appTimezone(): string {
    return this.get('APP_TIMEZONE');
  }

  get workStartTime(): string {
    return this.get('WORK_START_TIME');
  }

  get cookieSecure(): boolean {
    return this.get('COOKIE_SECURE');
  }

  get seedOnStart(): boolean {
    return this.get('SEED_ON_START');
  }
}
