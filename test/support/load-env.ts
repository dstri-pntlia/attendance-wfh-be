import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile();

if (!process.env.DATABASE_URL) {
  throw new Error(
    'E2E tests need DATABASE_URL pointing at a PostgreSQL database. ' +
      'They only create and drop a temporary schema inside it.',
  );
}
