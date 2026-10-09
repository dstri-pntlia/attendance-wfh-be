import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { DataSource } from 'typeorm';
import { Attendance } from '../../src/core/database/entities/attendance.entity.js';
import { Department } from '../../src/core/database/entities/department.entity.js';
import { Employee } from '../../src/core/database/entities/employee.entity.js';
import { StoredFile } from '../../src/core/database/entities/stored-file.entity.js';
import { User } from '../../src/core/database/entities/user.entity.js';
import { CreateUsers1791200000001 } from '../../src/core/database/migrations/1791200000001-CreateUsers.js';
import { CreateDepartments1791200000002 } from '../../src/core/database/migrations/1791200000002-CreateDepartments.js';
import { CreateEmployees1791200000003 } from '../../src/core/database/migrations/1791200000003-CreateEmployees.js';
import { CreateStoredFiles1791200000004 } from '../../src/core/database/migrations/1791200000004-CreateStoredFiles.js';
import { CreateAttendances1791200000005 } from '../../src/core/database/migrations/1791200000005-CreateAttendances.js';
import { databaseOptions } from '../../src/core/database/data-source.js';

export interface ScratchSchema {
  dataSource: DataSource;
  drop(): Promise<void>;
}

export async function createScratchSchema(
  databaseUrl: string,
): Promise<ScratchSchema> {
  const schema = `scratch_${randomBytes(6).toString('hex')}`;
  const admin = new pg.Client({ connectionString: databaseUrl });
  await admin.connect();
  await admin.query(`CREATE SCHEMA "${schema}"`);

  const dataSource = new DataSource({
    ...databaseOptions,
    url: databaseUrl,
    entities: [User, Department, Employee, StoredFile, Attendance],
    migrations: [
      CreateUsers1791200000001,
      CreateDepartments1791200000002,
      CreateEmployees1791200000003,
      CreateStoredFiles1791200000004,
      CreateAttendances1791200000005,
    ],
    extra: { ...databaseOptions.extra, options: `-c search_path=${schema}` },
  });

  return {
    dataSource,
    async drop() {
      try {
        if (dataSource.isInitialized) await dataSource.destroy();
        await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      } finally {
        await admin.end();
      }
    },
  };
}
