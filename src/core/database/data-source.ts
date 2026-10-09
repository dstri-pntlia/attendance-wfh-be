import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';

if (existsSync('.env')) process.loadEnvFile();

const directory = import.meta.dirname.replaceAll('\\', '/');

export const databaseOptions = {
  type: 'postgres' as const,
  entities: [`${directory}/entities/*.entity.{ts,js}`],
  migrations: [`${directory}/migrations/*.{ts,js}`],
  synchronize: false,
  extra: { idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 },
};

const dataSource = new DataSource({
  ...databaseOptions,
  url: process.env.DATABASE_URL,
});

export default dataSource;
