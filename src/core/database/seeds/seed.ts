import { randomUUID } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import { hashPassword } from '../../../common/utils/password.util.js';
import { Department } from '../entities/department.entity.js';
import { Employee, EmployeeStatus } from '../entities/employee.entity.js';
import { User, UserRole } from '../entities/user.entity.js';
import {
  DEMO_EMPLOYEE_PASSWORD,
  DEMO_EMPLOYEES,
  DEPARTMENTS,
  HR_ADMIN,
} from './seed-data.js';

export type PasswordHash = (password: string) => Promise<string>;

export interface SeedSummary {
  departments: number;
  users: { created: number; existing: number };
  employees: { created: number; existing: number };
}

export async function runSeed(
  dataSource: DataSource,
  hash: PasswordHash = hashPassword,
): Promise<SeedSummary> {
  return dataSource.transaction(async (manager) => {
    const departmentIds = await upsertDepartments(manager);
    const summary: SeedSummary = {
      departments: departmentIds.size,
      users: { created: 0, existing: 0 },
      employees: { created: 0, existing: 0 },
    };

    const hrAdmin = await ensureUser(manager, hash, {
      email: HR_ADMIN.email,
      password: HR_ADMIN.password,
      role: UserRole.HR_ADMIN,
      isActive: true,
    });
    tally(summary.users, hrAdmin.created);

    for (const demo of DEMO_EMPLOYEES) {
      const user = await ensureUser(manager, hash, {
        email: demo.email,
        password: DEMO_EMPLOYEE_PASSWORD,
        role: UserRole.EMPLOYEE,
        isActive: demo.status === EmployeeStatus.ACTIVE,
      });
      tally(summary.users, user.created);

      const departmentId = departmentIds.get(demo.departmentCode);
      if (!departmentId) {
        throw new Error(`Seed department ${demo.departmentCode} is missing`);
      }
      const alreadySeeded = await manager.exists(Employee, {
        where: [{ employeeNumber: demo.employeeNumber }, { userId: user.id }],
      });
      if (alreadySeeded) {
        summary.employees.existing++;
        continue;
      }
      await manager.insert(Employee, {
        id: randomUUID(),
        userId: user.id,
        employeeNumber: demo.employeeNumber,
        fullName: demo.fullName,
        phone: demo.phone,
        position: demo.position,
        departmentId,
        hireDate: demo.hireDate,
        status: demo.status,
        createdBy: null,
        updatedBy: null,
      });
      summary.employees.created++;
    }

    return summary;
  });
}

function tally(
  counter: { created: number; existing: number },
  created: boolean,
): void {
  if (created) counter.created++;
  else counter.existing++;
}

async function upsertDepartments(
  manager: EntityManager,
): Promise<Map<string, string>> {
  await manager
    .createQueryBuilder()
    .insert()
    .into(Department)
    .values(DEPARTMENTS.map((d) => ({ id: randomUUID(), ...d })))
    .orUpdate(['name'], ['code'])
    .execute();

  const rows = await manager.find(Department);
  return new Map(rows.map((d) => [d.code, d.id]));
}

interface UserSeed {
  email: string;
  password: string;
  role: UserRole;
  isActive: boolean;
}

async function ensureUser(
  manager: EntityManager,
  hash: PasswordHash,
  seed: UserSeed,
): Promise<{ id: string; created: boolean }> {
  const existing = await manager.findOne(User, {
    where: { email: seed.email },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const id = randomUUID();
  await manager.insert(User, {
    id,
    email: seed.email,
    passwordHash: await hash(seed.password),
    role: seed.role,
    isActive: seed.isActive,
  });
  return { id, created: true };
}
