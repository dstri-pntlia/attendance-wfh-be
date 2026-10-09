import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['reflect-metadata', './test/support/load-env.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'e2e-test-secret-that-is-at-least-32-characters',
      JWT_ACCESS_TTL: '15m',
      REFRESH_TOKEN_TTL_DAYS: '7',
      FRONTEND_ORIGIN: 'http://localhost:5173',
      COOKIE_SECURE: 'false',
      S3_ENDPOINT: 'https://e2e.r2.cloudflarestorage.com',
      S3_BUCKET: 'e2e-bucket',
      S3_ACCESS_KEY_ID: 'e2e-key',
      S3_SECRET_ACCESS_KEY: 'e2e-secret',
    },
  },
});
