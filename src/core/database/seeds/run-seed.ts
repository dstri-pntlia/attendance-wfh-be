import dataSource from '../data-source.js';
import { runSeed } from './seed.js';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set (see .env.example).');
  }
  await dataSource.initialize();
  try {
    if (await dataSource.showMigrations()) {
      throw new Error(
        'Pending migrations: run `pnpm migration:run` before seeding.',
      );
    }
    const summary = await runSeed(dataSource);
    process.stdout.write(
      `${JSON.stringify({ seed: 'ok', ...summary }, null, 2)}\n`,
    );
  } finally {
    await dataSource.destroy();
  }
}

try {
  await main();
} catch (error) {
  process.stderr.write(`Seed failed: ${(error as Error).message}\n`);
  process.exitCode = 1;
}
