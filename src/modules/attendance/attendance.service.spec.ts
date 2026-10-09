import { Readable } from 'node:stream';
import { NotFoundException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import type { AppConfigService } from '../../config/app-config.service.js';
import {
  type Attendance,
  AttendanceStatus,
} from '../../core/database/entities/attendance.entity.js';
import { UserRole } from '../../core/database/entities/user.entity.js';
import type { AuthUser } from '../auth/decorators/auth.decorators.js';
import type { EmployeesService } from '../employees/employees.service.js';
import { AttendanceService } from './attendance.service.js';

const JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);
const NOT_AN_IMAGE = Buffer.from('%PDF-1.7 definitely not a photo', 'ascii');

const OWNER_ID = '0b8c6a3e-6c1e-4b8e-9d0a-2f9f6c1b7a10';
const OTHER_ID = '8f2d1c34-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const EMPLOYEE_ID = 'e1e1e1e1-0000-4000-8000-00000000000a';
const ATTENDANCE_ID = 'c3d4e5f6-0000-4000-8000-000000000009';
const PHOTO_ID = 'f0f0f0f0-0000-4000-8000-00000000000b';

const employee = (id: string): AuthUser => ({
  id,
  email: `${id}@example.com`,
  role: UserRole.EMPLOYEE,
});
const owner = employee(OWNER_ID);
const hrAdmin: AuthUser = {
  id: 'a1b2c3d4-0000-4000-8000-000000000001',
  email: 'hr@example.com',
  role: UserRole.HR_ADMIN,
};

const attendanceOwnedBy = (
  userId: string,
  overrides: Record<string, unknown> = {},
) =>
  ({
    id: ATTENDANCE_ID,
    employee: { userId },
    checkInPhoto: {
      storageKey: 'abc.jpeg',
      mimeType: 'image/jpeg',
      sizeBytes: JPEG.length,
    },
    checkOutPhoto: null,
    ...overrides,
  }) as unknown as Attendance;

function createMocks() {
  const manager = {
    create: vi.fn((_entity: unknown, input: object) => ({ ...input })),
    merge: vi.fn((_entity: unknown, target: object, patch: object) =>
      Object.assign(target, patch),
    ),
    save: vi.fn((entity: Record<string, unknown>) =>
      Promise.resolve({
        id: entity.storageKey ? PHOTO_ID : ATTENDANCE_ID,
        ...entity,
      }),
    ),
  };
  const qb = {
    innerJoinAndSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    getRawMany: vi.fn().mockResolvedValue([]),
  };
  const attendances = {
    existsBy: vi.fn().mockResolvedValue(false),
    findOneBy: vi.fn().mockResolvedValue(null),
    findOne: vi.fn().mockResolvedValue(null),
    findAndCount: vi.fn().mockResolvedValue([[], 0]),
    createQueryBuilder: vi.fn(() => qb),
  };
  const dataSource = {
    transaction: vi.fn((run: (m: typeof manager) => Promise<unknown>) =>
      run(manager),
    ),
  };
  const storage = {
    save: vi.fn().mockResolvedValue({
      storageKey: 'generated-key.jpeg',
      mimeType: 'image/jpeg',
      sizeBytes: JPEG.length,
      sha256: 'a'.repeat(64),
    }),
    openStream: vi.fn().mockResolvedValue(Readable.from([JPEG])),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const employees = {
    countActive: vi.fn().mockResolvedValue(0),
    findSummaryByUserId: vi.fn().mockResolvedValue({
      id: EMPLOYEE_ID,
      employeeNumber: 'EMP-0001',
      fullName: 'Budi Santoso',
    }),
  };
  const config = { appTimezone: 'Asia/Jakarta', workStartTime: '09:00' };
  return { manager, qb, attendances, dataSource, storage, employees, config };
}

describe('AttendanceService', () => {
  let mocks: ReturnType<typeof createMocks>;
  let service: AttendanceService;

  const savedAttendance = () =>
    mocks.manager.create.mock.calls.at(-1)![1] as Record<string, unknown>;

  const lastSaved = () => mocks.manager.save.mock.calls.at(-1)![0];

  beforeEach(() => {
    mocks = createMocks();
    service = new AttendanceService(
      mocks.attendances as unknown as Repository<Attendance>,
      mocks.dataSource as unknown as DataSource,
      mocks.storage,
      mocks.employees as unknown as EmployeesService,
      mocks.config as AppConfigService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const at = (iso: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
  };

  describe('checkIn', () => {
    it('times the check-in by the server clock, ignoring what the client claims', async () => {
      at('2026-10-06T02:30:00.000Z');

      await service.checkIn(owner, {
        photo: JPEG,
        clientReportedAt: '2001-01-01T00:00:00.000Z',
      });

      const saved = savedAttendance();
      expect(saved.checkInAt).toEqual(new Date('2026-10-06T02:30:00.000Z'));
      expect(saved.clientReportedAt).toEqual(
        new Date('2001-01-01T00:00:00.000Z'),
      );
    });

    it.each([
      [
        '2026-10-06T16:59:00.000Z',
        '2026-10-06',
        'just before Jakarta midnight',
      ],
      ['2026-10-06T17:00:00.000Z', '2026-10-07', 'at Jakarta midnight'],
      ['2026-10-06T17:01:00.000Z', '2026-10-07', 'just after Jakarta midnight'],
    ])('resolves %s to work date %s (%s)', async (iso, expected) => {
      at(iso);

      await service.checkIn(owner, { photo: JPEG });

      expect(savedAttendance().workDate).toBe(expected);
    });

    it.each([
      ['2026-10-06T16:59:00.000Z', 'attendance/2026/10/06'],
      ['2026-10-06T17:00:00.000Z', 'attendance/2026/10/07'],
    ])('stores %s under %s, following the work date', async (iso, expected) => {
      at(iso);

      await service.checkIn(owner, { photo: JPEG });

      expect(mocks.storage.save).toHaveBeenCalledWith(
        JPEG,
        'image/jpeg',
        expected,
      );
    });

    it.each([
      ['2026-10-06T01:59:00.000Z', 'ON_TIME', '08:59 WIB'],
      ['2026-10-06T02:00:00.000Z', 'ON_TIME', '09:00 WIB exactly'],
      ['2026-10-06T02:01:00.000Z', 'LATE', '09:01 WIB'],
    ])('marks %s as %s (%s) — BR-13', async (iso, expected) => {
      at(iso);

      await service.checkIn(owner, { photo: JPEG });

      expect(savedAttendance().status).toBe(expected);
    });

    it('refuses a second check-in on the same work date', async () => {
      mocks.attendances.existsBy.mockResolvedValue(true);

      await expect(
        service.checkIn(owner, { photo: JPEG }),
      ).rejects.toMatchObject({
        code: 'ATTENDANCE_ALREADY_SUBMITTED',
        status: 409,
      });
    });

    it('writes nothing at all when the day is already submitted', async () => {
      mocks.attendances.existsBy.mockResolvedValue(true);

      await expect(service.checkIn(owner, { photo: JPEG })).rejects.toThrow();

      expect(mocks.storage.save).not.toHaveBeenCalled();
      expect(mocks.dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects content that is not a supported image, whatever it is named', async () => {
      await expect(
        service.checkIn(owner, { photo: NOT_AN_IMAGE, originalName: 'a.jpg' }),
      ).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE_TYPE', status: 415 });

      expect(mocks.storage.save).not.toHaveBeenCalled();
    });

    it('refuses an account that has no employee profile', async () => {
      mocks.employees.findSummaryByUserId.mockResolvedValue(null);

      await expect(
        service.checkIn(hrAdmin, { photo: JPEG }),
      ).rejects.toMatchObject({
        code: 'EMPLOYEE_PROFILE_REQUIRED',
        status: 403,
      });
    });

    it('stores the request origin for audit without trusting it', async () => {
      await service.checkIn(owner, {
        photo: JPEG,
        ipAddress: '203.0.113.7',
        userAgent: 'Mozilla/5.0',
        notes: '  on site  ',
      });

      expect(savedAttendance()).toMatchObject({
        ipAddress: '203.0.113.7',
        userAgent: 'Mozilla/5.0',
      });
    });

    it('truncates an oversized user agent to the column width', async () => {
      await service.checkIn(owner, { photo: JPEG, userAgent: 'x'.repeat(900) });

      expect(savedAttendance().userAgent).toHaveLength(500);
    });

    it.each([
      ['notes', { photo: JPEG }, 'notes'],
      ['clientReportedAt', { photo: JPEG }, 'clientReportedAt'],
      ['ipAddress', { photo: JPEG }, 'ipAddress'],
    ])(
      'records a missing %s as null, never undefined',
      async (_l, input, key) => {
        await service.checkIn(owner, input);
        expect(savedAttendance()[key]).toBeNull();
      },
    );

    it('links the attendance to the photo row written in the same transaction', async () => {
      await service.checkIn(owner, { photo: JPEG });

      expect(savedAttendance()).toMatchObject({
        employeeId: EMPLOYEE_ID,
        checkInPhotoId: PHOTO_ID,
      });
    });

    it('returns the API shape, with a photo URL and no employee block', async () => {
      const result = await service.checkIn(owner, { photo: JPEG });

      expect(result.photoUrl).toBe(
        `/api/v1/attendances/${ATTENDANCE_ID}/photo`,
      );
      expect(result.employee).toBeUndefined();
    });
  });

  describe('checkIn compensation', () => {
    it('deletes the uploaded file when the transaction fails', async () => {
      const dbError = new Error('insert failed');
      mocks.dataSource.transaction.mockRejectedValueOnce(dbError);

      await expect(service.checkIn(owner, { photo: JPEG })).rejects.toBe(
        dbError,
      );

      expect(mocks.storage.delete).toHaveBeenCalledWith('generated-key.jpeg');
    });

    it('keeps the file when the transaction succeeds', async () => {
      await service.checkIn(owner, { photo: JPEG });
      expect(mocks.storage.delete).not.toHaveBeenCalled();
    });
  });

  describe('checkOut', () => {
    const checkedIn = (overrides: Record<string, unknown> = {}) => ({
      id: ATTENDANCE_ID,
      employeeId: EMPLOYEE_ID,
      workDate: '2026-10-06',
      checkInAt: new Date('2026-10-06T02:00:00.000Z'),
      checkOutAt: null,
      checkOutPhotoId: null,
      status: 'ON_TIME',
      notes: null,
      ...overrides,
    });

    it('stamps the check-out from the server clock', async () => {
      at('2026-10-06T10:15:00.000Z');
      mocks.attendances.findOneBy.mockResolvedValue(checkedIn());

      await service.checkOut(owner, {});

      const saved = lastSaved();
      expect(saved.checkOutAt).toEqual(new Date('2026-10-06T10:15:00.000Z'));
    });

    it('accepts a check-out with no photo at all', async () => {
      at('2026-10-06T10:15:00.000Z');
      mocks.attendances.findOneBy.mockResolvedValue(checkedIn());

      await service.checkOut(owner, {});

      expect(mocks.storage.save).not.toHaveBeenCalled();
      const saved = lastSaved();
      expect(saved.checkOutPhotoId).toBeNull();
    });

    it('links a photo when one is supplied', async () => {
      at('2026-10-06T10:15:00.000Z');
      mocks.attendances.findOneBy.mockResolvedValue(checkedIn());

      await service.checkOut(owner, { photo: JPEG });

      expect(mocks.storage.save).toHaveBeenCalledWith(
        JPEG,
        'image/jpeg',
        'attendance/2026/10/06',
      );
      const saved = lastSaved();
      expect(saved.checkOutPhotoId).toBe(PHOTO_ID);
    });

    it('rejects a photo that is not a supported image', async () => {
      at('2026-10-06T10:15:00.000Z');
      mocks.attendances.findOneBy.mockResolvedValue(checkedIn());

      await expect(
        service.checkOut(owner, { photo: NOT_AN_IMAGE }),
      ).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE_TYPE', status: 415 });
    });

    it('refuses when today has no check-in', async () => {
      at('2026-10-06T10:15:00.000Z');

      await expect(service.checkOut(owner, {})).rejects.toMatchObject({
        code: 'NOT_CHECKED_IN',
        status: 409,
      });
    });

    it('refuses a second check-out', async () => {
      at('2026-10-06T10:15:00.000Z');
      mocks.attendances.findOneBy.mockResolvedValue(
        checkedIn({ checkOutAt: new Date('2026-10-06T09:00:00.000Z') }),
      );

      await expect(service.checkOut(owner, {})).rejects.toMatchObject({
        code: 'ALREADY_CHECKED_OUT',
        status: 409,
      });
    });

    it('writes nothing when the day cannot be checked out', async () => {
      at('2026-10-06T10:15:00.000Z');
      mocks.attendances.findOneBy.mockResolvedValue(
        checkedIn({ checkOutAt: new Date('2026-10-06T09:00:00.000Z') }),
      );

      await expect(service.checkOut(owner, { photo: JPEG })).rejects.toThrow();

      expect(mocks.storage.save).not.toHaveBeenCalled();
      expect(mocks.dataSource.transaction).not.toHaveBeenCalled();
    });

    it('deletes the uploaded photo when the transaction fails', async () => {
      at('2026-10-06T10:15:00.000Z');
      mocks.attendances.findOneBy.mockResolvedValue(checkedIn());
      const dbError = new Error('update failed');
      mocks.dataSource.transaction.mockRejectedValueOnce(dbError);

      await expect(service.checkOut(owner, { photo: JPEG })).rejects.toBe(
        dbError,
      );

      expect(mocks.storage.delete).toHaveBeenCalledWith('generated-key.jpeg');
    });

    it('refuses an account that has no employee profile', async () => {
      mocks.employees.findSummaryByUserId.mockResolvedValue(null);

      await expect(service.checkOut(hrAdmin, {})).rejects.toMatchObject({
        code: 'EMPLOYEE_PROFILE_REQUIRED',
        status: 403,
      });
    });
  });

  describe('findToday', () => {
    it('reports not checked in without inventing an attendance', async () => {
      at('2026-10-06T02:30:00.000Z');

      await expect(service.findToday(owner)).resolves.toEqual({
        workDate: '2026-10-06',
        checkedIn: false,
        attendance: null,
      });
    });

    it('reports the attendance once it exists', async () => {
      at('2026-10-06T02:30:00.000Z');
      mocks.attendances.findOneBy.mockResolvedValue({
        id: ATTENDANCE_ID,
        workDate: '2026-10-06',
        checkInAt: new Date('2026-10-06T02:30:00.000Z'),
        checkOutAt: null,
        status: 'ON_TIME',
        notes: null,
      });

      const today = await service.findToday(owner);

      expect(today.checkedIn).toBe(true);
      expect(today.attendance).toMatchObject({ id: ATTENDANCE_ID });
    });

    it('asks only for the caller’s own record on today’s Jakarta date', async () => {
      at('2026-10-06T17:30:00.000Z');

      await service.findToday(owner);

      expect(mocks.attendances.findOneBy).toHaveBeenCalledWith({
        employeeId: EMPLOYEE_ID,
        workDate: '2026-10-07',
      });
    });
  });

  describe('findMine', () => {
    const whereOf = () =>
      mocks.attendances.findAndCount.mock.calls.at(-1)![0] as Record<
        string,
        unknown
      >;

    it('scopes every query to the caller, never to a supplied id', async () => {
      await service.findMine(owner, { page: 1, limit: 20 });

      expect(whereOf().where).toMatchObject({ employeeId: EMPLOYEE_ID });
    });

    it('defaults to the newest work date first', async () => {
      await service.findMine(owner, { page: 1, limit: 20 });

      expect(whereOf().order).toEqual({ workDate: 'DESC', id: 'ASC' });
    });

    it('honours an explicit ascending sort', async () => {
      await service.findMine(owner, {
        page: 1,
        limit: 20,
        sort: 'workDate:asc',
      });

      expect(whereOf().order).toEqual({ workDate: 'ASC', id: 'ASC' });
    });

    it('pages through results with the standard envelope', async () => {
      mocks.attendances.findAndCount.mockResolvedValue([[], 57]);

      const page = await service.findMine(owner, { page: 2, limit: 20 });

      expect(whereOf()).toMatchObject({ skip: 20, take: 20 });
      expect(page.meta).toEqual({
        page: 2,
        limit: 20,
        total: 57,
        totalPages: 3,
      });
    });

    it('filters by an inclusive work-date range when both ends are given', async () => {
      await service.findMine(owner, {
        page: 1,
        limit: 20,
        from: '2026-10-01',
        to: '2026-10-31',
      });

      expect(whereOf().where).toHaveProperty('workDate');
    });
  });

  describe('findAll — HR monitoring', () => {
    const conditions = () =>
      [
        ...mocks.qb.where.mock.calls,
        ...mocks.qb.andWhere.mock.calls,
      ] as unknown[][];
    const sql = () =>
      conditions()
        .map((c) => String(c[0]))
        .join(' | ');
    const params = () =>
      Object.assign({}, ...conditions().map((c) => c[1] ?? {})) as Record<
        string,
        unknown
      >;

    it('defaults both ends of the range to today in Jakarta', async () => {
      at('2026-10-06T17:30:00.000Z');

      await service.findAll({ page: 1, limit: 20 });

      expect(params()).toMatchObject({
        from: '2026-10-07',
        to: '2026-10-07',
      });
    });

    it('honours an explicit range', async () => {
      at('2026-10-06T02:00:00.000Z');

      await service.findAll({
        page: 1,
        limit: 20,
        from: '2026-09-01',
        to: '2026-09-30',
      });

      expect(params()).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
    });

    it('joins employee and department in one query, avoiding N+1', async () => {
      await service.findAll({ page: 1, limit: 20 });

      expect(mocks.qb.innerJoinAndSelect).toHaveBeenCalledWith(
        'attendance.employee',
        'employee',
      );
      expect(mocks.qb.innerJoinAndSelect).toHaveBeenCalledWith(
        'employee.department',
        'department',
      );
    });

    it.each([
      ['employeeId', { employeeId: EMPLOYEE_ID }, 'attendance.employeeId'],
      ['departmentId', { departmentId: EMPLOYEE_ID }, 'employee.departmentId'],
      ['status', { status: AttendanceStatus.LATE }, 'attendance.status'],
    ])('filters by %s', async (_label, filter, column) => {
      await service.findAll({ page: 1, limit: 20, ...filter });

      expect(sql()).toContain(column);
    });

    it('searches employee name and number together', async () => {
      await service.findAll({ page: 1, limit: 20, search: 'Budi' });

      expect(sql()).toContain('employee.fullName ILIKE');
      expect(sql()).toContain('employee.employeeNumber ILIKE');
      expect(params().search).toBe('%Budi%');
    });

    it('escapes LIKE wildcards so a search cannot widen the match', async () => {
      await service.findAll({ page: 1, limit: 20, search: '100%_x' });

      expect(params().search).toBe('%100\\%\\_x%');
    });

    it('applies no filters beyond the date range when none are given', async () => {
      await service.findAll({ page: 1, limit: 20 });

      expect(mocks.qb.andWhere).not.toHaveBeenCalled();
    });

    it('defaults to newest work date, then newest check-in', async () => {
      await service.findAll({ page: 1, limit: 20 });

      expect(mocks.qb.orderBy).toHaveBeenCalledWith(
        'attendance.workDate',
        'DESC',
      );
      expect(mocks.qb.addOrderBy).toHaveBeenCalledWith(
        'attendance.checkInAt',
        'DESC',
      );
    });

    it('maps the employeeName sort onto the joined column', async () => {
      await service.findAll({
        page: 1,
        limit: 20,
        sort: 'employeeName:asc',
      });

      expect(mocks.qb.orderBy).toHaveBeenCalledWith('employee.fullName', 'ASC');
    });

    it('does not add a redundant secondary sort when already sorting by check-in', async () => {
      await service.findAll({ page: 1, limit: 20, sort: 'checkInAt:asc' });

      expect(mocks.qb.orderBy).toHaveBeenCalledWith(
        'attendance.checkInAt',
        'ASC',
      );
      expect(mocks.qb.addOrderBy).not.toHaveBeenCalledWith(
        'attendance.checkInAt',
        'DESC',
      );
    });

    it('pages with the standard envelope and includes the employee block', async () => {
      mocks.qb.getManyAndCount.mockResolvedValue([
        [
          {
            id: ATTENDANCE_ID,
            workDate: '2026-10-06',
            checkInAt: new Date('2026-10-06T02:00:00.000Z'),
            checkOutAt: null,
            status: 'ON_TIME',
            notes: null,
            employee: {
              id: EMPLOYEE_ID,
              employeeNumber: 'EMP-0001',
              fullName: 'Budi Santoso',
              department: { id: 'd1', code: 'ENG', name: 'Engineering' },
            },
          },
        ],
        57,
      ]);

      const page = await service.findAll({ page: 2, limit: 20 });

      expect(mocks.qb.skip).toHaveBeenCalledWith(20);
      expect(mocks.qb.take).toHaveBeenCalledWith(20);
      expect(page.meta).toEqual({
        page: 2,
        limit: 20,
        total: 57,
        totalPages: 3,
      });
      expect(page.data[0].employee).toMatchObject({
        employeeNumber: 'EMP-0001',
        department: { code: 'ENG' },
      });
    });
  });

  describe('findOne', () => {
    const record = (userId: string) =>
      ({
        id: ATTENDANCE_ID,
        workDate: '2026-10-06',
        checkInAt: new Date('2026-10-06T02:00:00.000Z'),
        checkOutAt: null,
        status: 'ON_TIME',
        notes: null,
        employee: {
          id: EMPLOYEE_ID,
          userId,
          employeeNumber: 'EMP-0001',
          fullName: 'Budi Santoso',
          department: { id: 'd1', code: 'ENG', name: 'Engineering' },
        },
      }) as unknown as Attendance;

    it('includes the employee block for an HR admin', async () => {
      mocks.attendances.findOne.mockResolvedValue(record(OWNER_ID));

      const result = await service.findOne(ATTENDANCE_ID, hrAdmin);

      expect(result.employee).toMatchObject({ employeeNumber: 'EMP-0001' });
    });

    it('omits the employee block for the owner', async () => {
      mocks.attendances.findOne.mockResolvedValue(record(OWNER_ID));

      const result = await service.findOne(ATTENDANCE_ID, owner);

      expect(result.employee).toBeUndefined();
      expect(result.id).toBe(ATTENDANCE_ID);
    });

    it('answers 404 for another employee', async () => {
      mocks.attendances.findOne.mockResolvedValue(record(OWNER_ID));

      await expect(
        service.findOne(ATTENDANCE_ID, employee(OTHER_ID)),
      ).rejects.toThrow(NotFoundException);
    });

    it('answers the same 404 when it does not exist', async () => {
      await expect(service.findOne(ATTENDANCE_ID, hrAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getPhoto', () => {
    it.each([
      ['the owner', () => owner],
      ['an HR admin', () => hrAdmin],
    ])('streams the photo to %s', async (_label, actor) => {
      mocks.attendances.findOne.mockResolvedValue(attendanceOwnedBy(OWNER_ID));

      const photo = await service.getPhoto(ATTENDANCE_ID, actor());

      expect(mocks.storage.openStream).toHaveBeenCalledWith('abc.jpeg');
      expect(photo).toMatchObject({
        mimeType: 'image/jpeg',
        sizeBytes: JPEG.length,
      });
    });

    it('answers 404 for another employee without disclosing that the record exists', async () => {
      mocks.attendances.findOne.mockResolvedValue(attendanceOwnedBy(OWNER_ID));

      await expect(
        service.getPhoto(ATTENDANCE_ID, employee(OTHER_ID)),
      ).rejects.toThrow(NotFoundException);
    });

    it('answers the same 404 when the attendance does not exist', async () => {
      await expect(service.getPhoto(ATTENDANCE_ID, hrAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('never opens the file for someone who may not see it', async () => {
      mocks.attendances.findOne.mockResolvedValue(attendanceOwnedBy(OWNER_ID));

      await expect(
        service.getPhoto(ATTENDANCE_ID, employee(OTHER_ID)),
      ).rejects.toThrow(NotFoundException);

      expect(mocks.storage.openStream).not.toHaveBeenCalled();
    });

    it('streams the check-out photo when asked for it', async () => {
      mocks.attendances.findOne.mockResolvedValue(
        attendanceOwnedBy(OWNER_ID, {
          checkOutPhoto: {
            storageKey: 'out.png',
            mimeType: 'image/png',
            sizeBytes: 42,
          },
        }),
      );

      const photo = await service.getPhoto(ATTENDANCE_ID, owner, 'checkout');

      expect(mocks.storage.openStream).toHaveBeenCalledWith('out.png');
      expect(photo.mimeType).toBe('image/png');
    });

    it('answers 404 when the requested check-out photo was never taken', async () => {
      mocks.attendances.findOne.mockResolvedValue(attendanceOwnedBy(OWNER_ID));

      await expect(
        service.getPhoto(ATTENDANCE_ID, owner, 'checkout'),
      ).rejects.toThrow(NotFoundException);
    });

    it('still defaults to the check-in photo', async () => {
      mocks.attendances.findOne.mockResolvedValue(attendanceOwnedBy(OWNER_ID));

      await service.getPhoto(ATTENDANCE_ID, owner);

      expect(mocks.storage.openStream).toHaveBeenCalledWith('abc.jpeg');
    });
  });

  describe('getSummary', () => {
    it('counts each status and the active employees who have not checked in', async () => {
      mocks.employees.countActive.mockResolvedValue(10);
      mocks.qb.getRawMany.mockResolvedValue([
        { status: AttendanceStatus.ON_TIME, count: 5 },
        { status: AttendanceStatus.LATE, count: 2 },
      ]);

      await expect(service.getSummary('2026-10-06')).resolves.toEqual({
        date: '2026-10-06',
        activeEmployees: 10,
        checkedIn: 7,
        onTime: 5,
        late: 2,
        notCheckedIn: 3,
      });
      expect(mocks.qb.where).toHaveBeenCalledWith(
        'attendance.workDate = :workDate',
        { workDate: '2026-10-06' },
      );
    });

    it('reports zeros for a date without attendance', async () => {
      mocks.employees.countActive.mockResolvedValue(4);

      await expect(service.getSummary('2020-01-01')).resolves.toEqual({
        date: '2020-01-01',
        activeEmployees: 4,
        checkedIn: 0,
        onTime: 0,
        late: 0,
        notCheckedIn: 4,
      });
    });

    it('never reports a negative notCheckedIn', async () => {
      mocks.employees.countActive.mockResolvedValue(1);
      mocks.qb.getRawMany.mockResolvedValue([
        { status: AttendanceStatus.ON_TIME, count: 3 },
      ]);

      const summary = await service.getSummary('2026-10-06');

      expect(summary.checkedIn).toBe(3);
      expect(summary.notCheckedIn).toBe(0);
    });

    it('defaults to today in Jakarta', async () => {
      at('2026-10-06T17:30:00.000Z');

      const summary = await service.getSummary();

      expect(summary.date).toBe('2026-10-07');
    });
  });
});
