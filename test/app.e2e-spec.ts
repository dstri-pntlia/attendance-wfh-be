import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { Response } from 'supertest';
import { EmployeeStatus } from '../src/core/database/entities/employee.entity.js';
import {
  DEMO_EMPLOYEE_PASSWORD,
  DEMO_EMPLOYEES,
  HR_ADMIN,
} from '../src/core/database/seeds/seed-data.js';
import { runSeed } from '../src/core/database/seeds/seed.js';
import { InMemoryStorage } from './support/in-memory-storage.js';
import {
  createScratchSchema,
  type ScratchSchema,
} from './support/scratch-schema.js';
import { createTestApp } from './support/test-app.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const ACTIVE_EMPLOYEES = DEMO_EMPLOYEES.filter(
  (e) => e.status === EmployeeStatus.ACTIVE,
).length;

function expectError(res: Response, statusCode: number, code: string): void {
  expect(res.status).toBe(statusCode);
  expect(res.body).toEqual({
    statusCode,
    code,
    message: expect.any(String),
    timestamp: expect.any(String),
  });
}

describe('WFH attendance API (e2e)', () => {
  let scratch: ScratchSchema;
  let app: NestExpressApplication;
  let http: ReturnType<NestExpressApplication['getHttpServer']>;
  const storage = new InMemoryStorage();

  const login = (email: string, password: string) =>
    request(http).post('/api/v1/auth/login').send({ email, password });

  const tokenFor = async (email: string, password: string) => {
    const res = await login(email, password).expect(200);
    return res.body.accessToken as string;
  };

  const as = (token: string) => {
    const auth = { Authorization: `Bearer ${token}` };
    return {
      get: (path: string) => request(http).get(`/api/v1${path}`).set(auth),
      post: (path: string) => request(http).post(`/api/v1${path}`).set(auth),
      patch: (path: string) => request(http).patch(`/api/v1${path}`).set(auth),
    };
  };

  let hrToken: string;
  let budiToken: string;
  let engineeringId: string;

  beforeAll(async () => {
    scratch = await createScratchSchema(process.env.DATABASE_URL as string);
    await scratch.dataSource.initialize();
    await scratch.dataSource.runMigrations();
    await runSeed(scratch.dataSource);

    app = await createTestApp(scratch.dataSource, storage);
    http = app.getHttpServer();

    hrToken = await tokenFor(HR_ADMIN.email, HR_ADMIN.password);
    budiToken = await tokenFor('budi@example.com', DEMO_EMPLOYEE_PASSWORD);

    const departments = await as(hrToken).get('/departments').expect(200);
    engineeringId = (departments.body as { id: string; code: string }[]).find(
      (d) => d.code === 'ENG',
    )!.id;
  });

  afterAll(async () => {
    await app?.close();
    await scratch?.drop();
  });

  describe('authentication', () => {
    it('logs in and returns the user without internal fields', async () => {
      const res = await login(HR_ADMIN.email, HR_ADMIN.password).expect(200);

      expect(res.body).toEqual({
        accessToken: expect.any(String),
        expiresIn: expect.any(Number),
        user: {
          id: expect.any(String),
          email: HR_ADMIN.email,
          role: 'HR_ADMIN',
          employee: null,
        },
      });
      expect(res.headers['set-cookie']?.[0]).toMatch(
        /^refresh_token=.+HttpOnly; SameSite=Lax/,
      );
    });

    it('rejects a wrong password with the standard error body', async () => {
      expectError(
        await login(HR_ADMIN.email, 'WrongPassword1'),
        401,
        'INVALID_CREDENTIALS',
      );
    });

    it('refreshes the session from the cookie and logs out', async () => {
      const agent = request.agent(http);
      await agent
        .post('/api/v1/auth/login')
        .send({ email: 'siti@example.com', password: DEMO_EMPLOYEE_PASSWORD })
        .expect(200);

      const refreshed = await agent.post('/api/v1/auth/refresh').expect(200);
      expect(refreshed.body.user.email).toBe('siti@example.com');

      await agent.post('/api/v1/auth/logout').expect(204);
      expectError(
        await agent.post('/api/v1/auth/refresh'),
        401,
        'INVALID_REFRESH_TOKEN',
      );
    });

    it.each(['/employees', '/attendances/summary'])(
      'requires a token and the HR role for %s',
      async (path) => {
        expectError(
          await request(http).get(`/api/v1${path}`),
          401,
          'UNAUTHENTICATED',
        );
        expectError(await as(budiToken).get(path), 403, 'FORBIDDEN');
      },
    );

    it('changes the password and ends every existing session', async () => {
      const email = 'dewi@example.com';
      const session = await login(email, DEMO_EMPLOYEE_PASSWORD).expect(200);
      const token = session.body.accessToken as string;
      const oldCookie = session.headers['set-cookie'] as unknown as string[];

      expectError(
        await as(token).patch('/auth/me/password').send({
          currentPassword: 'WrongSecret1',
          newPassword: 'NewSecret456',
        }),
        400,
        'CURRENT_PASSWORD_INCORRECT',
      );
      const same = await as(token).patch('/auth/me/password').send({
        currentPassword: DEMO_EMPLOYEE_PASSWORD,
        newPassword: DEMO_EMPLOYEE_PASSWORD,
      });
      expectError(same, 400, 'VALIDATION_FAILED');
      expect(same.body.message).toBe(
        'newPassword must differ from currentPassword',
      );

      await as(token)
        .patch('/auth/me/password')
        .send({
          currentPassword: DEMO_EMPLOYEE_PASSWORD,
          newPassword: 'NewSecret456',
        })
        .expect(204);

      expectError(await as(token).get('/auth/me'), 401, 'UNAUTHENTICATED');
      expectError(
        await request(http)
          .post('/api/v1/auth/refresh')
          .set('Cookie', oldCookie),
        401,
        'INVALID_REFRESH_TOKEN',
      );
      await login(email, 'NewSecret456').expect(200);
    });
  });

  describe('HR manages employees, the employee checks in', () => {
    const employee = {
      employeeNumber: 'E2E-0001',
      fullName: 'Rina Wulandari',
      email: 'rina@example.com',
      phone: '081234567890',
      position: 'QA Engineer',
      hireDate: '2026-01-05',
      password: 'Welcome123',
    };
    let employeeId: string;
    let employeeToken: string;
    let attendanceId: string;

    it('creates an employee', async () => {
      const res = await as(hrToken)
        .post('/employees')
        .send({ ...employee, departmentId: engineeringId })
        .expect(201);

      employeeId = res.body.id as string;
      expect(res.headers.location).toBe(`/api/v1/employees/${employeeId}`);
      expect(res.body).toMatchObject({
        employeeNumber: employee.employeeNumber,
        email: employee.email,
        status: 'ACTIVE',
        department: { code: 'ENG' },
      });
      expect(res.body).not.toHaveProperty('password');
    });

    it('rejects a duplicate email', async () => {
      const res = await as(hrToken)
        .post('/employees')
        .send({
          ...employee,
          employeeNumber: 'E2E-0002',
          departmentId: engineeringId,
        });
      expectError(res, 409, 'EMPLOYEE_EMAIL_TAKEN');
    });

    it('names every invalid field in the validation message', async () => {
      const res = await as(hrToken)
        .post('/employees')
        .send({ email: 'not-an-email' });
      expectError(res, 400, 'VALIDATION_FAILED');
      expect(res.body.message).toContain('employeeNumber');
      expect(res.body.message).toContain('email must be an email');
    });

    it('lets the new employee log in and check in with a photo', async () => {
      employeeToken = await tokenFor(employee.email, employee.password);

      const res = await as(employeeToken)
        .post('/attendances/check-in')
        .field('notes', 'Working on regression tests')
        .attach('photo', PNG, {
          filename: 'proof.png',
          contentType: 'image/png',
        })
        .expect(201);

      attendanceId = res.body.id as string;
      expect(['ON_TIME', 'LATE']).toContain(res.body.status);
      expect(res.headers.location).toBe(`/api/v1/attendances/${attendanceId}`);
    });

    it('allows only one check-in per day', async () => {
      const res = await as(employeeToken)
        .post('/attendances/check-in')
        .attach('photo', PNG, {
          filename: 'again.png',
          contentType: 'image/png',
        });
      expectError(res, 409, 'ATTENDANCE_ALREADY_SUBMITTED');
    });

    it('requires a photo', async () => {
      const res = await as(budiToken)
        .post('/attendances/check-in')
        .field('notes', 'no photo');
      expectError(res, 400, 'VALIDATION_FAILED');
      expect(res.body.message).toBe('A check-in photo is required.');
    });

    it('shows the attendance in the employee history', async () => {
      const res = await as(employeeToken).get('/attendances/me').expect(200);
      expect(res.body.meta.total).toBe(1);
      expect(res.body.data[0].id).toBe(attendanceId);
    });

    it('hides it from other employees', async () => {
      expectError(
        await as(budiToken).get(`/attendances/${attendanceId}`),
        404,
        'NOT_FOUND',
      );
    });

    it('shows it to HR, including the photo', async () => {
      const list = await as(hrToken)
        .get(`/attendances?search=${encodeURIComponent(employee.fullName)}`)
        .expect(200);
      const ids = (list.body.data as { id: string }[]).map((a) => a.id);
      expect(ids).toEqual([attendanceId]);

      const photo = await as(hrToken)
        .get(`/attendances/${attendanceId}/photo`)
        .expect(200);
      expect(photo.headers['content-type']).toBe('image/png');
      expect(Buffer.compare(photo.body as Buffer, PNG)).toBe(0);
    });

    it('summarises today, including the new check-in', async () => {
      const res = await as(hrToken).get('/attendances/summary').expect(200);
      expect(res.body).toEqual({
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        activeEmployees: ACTIVE_EMPLOYEES + 1,
        checkedIn: 1,
        onTime: expect.any(Number),
        late: expect.any(Number),
        notCheckedIn: ACTIVE_EMPLOYEES,
      });
      expect(res.body.onTime + res.body.late).toBe(1);
    });

    it('summarises a date without attendance as zeros', async () => {
      const res = await as(hrToken)
        .get('/attendances/summary?date=2020-01-01')
        .expect(200);
      expect(res.body).toEqual({
        date: '2020-01-01',
        activeEmployees: ACTIVE_EMPLOYEES + 1,
        checkedIn: 0,
        onTime: 0,
        late: 0,
        notCheckedIn: ACTIVE_EMPLOYEES + 1,
      });
      expectError(
        await as(hrToken).get('/attendances/summary?date=2026-13-01'),
        400,
        'VALIDATION_FAILED',
      );
    });

    it('cuts off a deactivated employee immediately', async () => {
      await as(hrToken)
        .patch(`/employees/${employeeId}/status`)
        .send({ status: 'INACTIVE' })
        .expect(200);

      expectError(
        await as(employeeToken).get('/auth/me'),
        401,
        'UNAUTHENTICATED',
      );
      expectError(
        await login(employee.email, employee.password),
        401,
        'INVALID_CREDENTIALS',
      );
    });
  });
});
