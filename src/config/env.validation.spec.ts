import { MAX_UPLOAD_BYTES, NodeEnv, validateEnv } from './env.validation.js';

const SECRET = 'a'.repeat(32);

const required = {
  DATABASE_URL: 'postgres://app:app@localhost:5432/wfh',
  JWT_ACCESS_SECRET: SECRET,
  FRONTEND_ORIGIN: 'http://localhost:5173,http://localhost:3000',
  S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
  S3_BUCKET: 'attendance-photos',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret',
};

describe('validateEnv', () => {
  it('applies documented defaults when only required variables are set', () => {
    const env = validateEnv(required);
    expect(env).toMatchObject({
      NODE_ENV: NodeEnv.Development,
      PORT: 8080,
      JWT_ACCESS_TTL: '15m',
      REFRESH_TOKEN_TTL_DAYS: 7,
      FRONTEND_ORIGIN: ['http://localhost:5173', 'http://localhost:3000'],
      S3_REGION: 'auto',
      UPLOAD_MAX_BYTES: MAX_UPLOAD_BYTES,
      APP_TIMEZONE: 'Asia/Jakarta',
      WORK_START_TIME: '09:00',
      COOKIE_SECURE: false,
      SEED_ON_START: false,
    });
  });

  it('converts strings to typed values', () => {
    const env = validateEnv({
      ...required,
      NODE_ENV: 'production',
      PORT: '3000',
      REFRESH_TOKEN_TTL_DAYS: '14',
      UPLOAD_MAX_BYTES: '1048576',
      COOKIE_SECURE: 'true',
      SEED_ON_START: 'true',
      FRONTEND_ORIGIN: ' https://app.example.com , http://localhost:5173 ,',
    });
    expect(env.NODE_ENV).toBe(NodeEnv.Production);
    expect(env.PORT).toBe(3000);
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(14);
    expect(env.UPLOAD_MAX_BYTES).toBe(1_048_576);
    expect(env.COOKIE_SECURE).toBe(true);
    expect(env.SEED_ON_START).toBe(true);
    expect(env.FRONTEND_ORIGIN).toEqual([
      'https://app.example.com',
      'http://localhost:5173',
    ]);
  });

  it('treats empty strings as unset', () => {
    expect(validateEnv({ ...required, PORT: '' }).PORT).toBe(8080);
  });

  it.each([
    ['DATABASE_URL', undefined],
    ['DATABASE_URL', 'mysql://app:app@localhost/wfh'],
    ['JWT_ACCESS_SECRET', undefined],
    ['JWT_ACCESS_SECRET', 'too-short'],
    ['FRONTEND_ORIGIN', undefined],
    ['FRONTEND_ORIGIN', ','],
    ['FRONTEND_ORIGIN', 'localhost:5173'],
    ['FRONTEND_ORIGIN', 'http://localhost:5173/'],
    ['FRONTEND_ORIGIN', 'http://localhost:5173/app'],
    ['FRONTEND_ORIGIN', '*'],
    ['NODE_ENV', 'staging'],
    ['PORT', 'abc'],
    ['PORT', '70000'],
    ['JWT_ACCESS_TTL', '15 minutes'],
    ['REFRESH_TOKEN_TTL_DAYS', '0'],
    ['UPLOAD_MAX_BYTES', String(MAX_UPLOAD_BYTES + 1)],
    ['APP_TIMEZONE', 'Asia/Atlantis'],
    ['WORK_START_TIME', '9am'],
    ['COOKIE_SECURE', 'yes'],
    ['SEED_ON_START', '1'],
  ])('rejects %s = %j', (key, value) => {
    const raw: Record<string, unknown> = { ...required, [key]: value };
    expect(() => validateEnv(raw)).toThrow(new RegExp(key));
  });

  it('reports every invalid variable at once', () => {
    const message = validationMessage({ PORT: 'abc' });
    for (const key of [
      'PORT',
      'DATABASE_URL',
      'JWT_ACCESS_SECRET',
      'FRONTEND_ORIGIN',
    ]) {
      expect(message).toContain(key);
    }
  });

  it('never includes secret values in the error message', () => {
    const secret = 'super-secret-but-short';
    const message = validationMessage({
      ...required,
      JWT_ACCESS_SECRET: secret,
    });
    expect(message).toContain('JWT_ACCESS_SECRET');
    expect(message).not.toContain(secret);
  });
});

function validationMessage(raw: Record<string, unknown>): string {
  try {
    validateEnv(raw);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error('expected validation to fail');
}
