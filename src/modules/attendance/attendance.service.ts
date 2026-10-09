import type { Readable } from 'node:stream';
import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-code.js';
import {
  paginate,
  type Paginated,
} from '../../common/pagination/paginated-response.js';
import { toOffset } from '../../common/pagination/pagination-query.dto.js';
import { parseSort } from '../../common/pagination/sort.js';
import { contains } from '../../common/utils/like.util.js';
import { isLate, toWorkDate } from '../../common/utils/time.util.js';
import { AppConfigService } from '../../config/app-config.service.js';
import {
  Attendance,
  AttendanceStatus,
} from '../../core/database/entities/attendance.entity.js';
import { StoredFile } from '../../core/database/entities/stored-file.entity.js';
import { UserRole } from '../../core/database/entities/user.entity.js';
import { detectMimeType } from '../../core/storage/file-type.util.js';
import { StorageService } from '../../core/storage/storage.service.js';
import type { AuthUser } from '../auth/decorators/auth.decorators.js';
import { EmployeesService } from '../employees/employees.service.js';
import { assertCanViewAttendance } from './attendance.policy.js';
import {
  ATTENDANCE_SORT_FIELDS,
  type AttendanceQueryDto,
  AttendanceResponseDto,
  type AttendanceStatusCounts,
  AttendanceSummaryResponseDto,
  DEFAULT_ATTENDANCE_SORT,
  DEFAULT_MONITORING_SORT,
  MONITORING_SORT_FIELDS,
  type MyAttendanceQueryDto,
  type PhotoKind,
  SORT_COLUMNS,
  TodayAttendanceResponseDto,
} from './dto/attendance.dto.js';

export interface PhotoStream {
  stream: Readable;
  mimeType: string;
  sizeBytes: number;
}

export interface CheckInInput {
  photo: Buffer;
  originalName?: string;
  notes?: string;
  clientReportedAt?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CheckOutInput {
  photo?: Buffer;
  originalName?: string;
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendances: Repository<Attendance>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly storage: StorageService,
    private readonly employees: EmployeesService,
    private readonly config: AppConfigService,
  ) {}

  async checkIn(
    actor: AuthUser,
    input: CheckInInput,
  ): Promise<AttendanceResponseDto> {
    const employeeId = await this.requireEmployeeId(actor);

    const mimeType = this.requireImage(input.photo);

    const checkInAt = new Date();
    const workDate = toWorkDate(checkInAt, this.config.appTimezone);

    if (await this.attendances.existsBy({ employeeId, workDate })) {
      throw this.alreadySubmitted();
    }

    const saved = await this.storage.save(input.photo, mimeType);
    try {
      const attendance = await this.dataSource.transaction(async (manager) => {
        const photo = await manager.save(
          manager.create(StoredFile, {
            storageKey: saved.storageKey,
            originalName: input.originalName ?? null,
            mimeType: saved.mimeType,
            sizeBytes: saved.sizeBytes,
            sha256: saved.sha256,
            uploadedBy: actor.id,
          }),
        );
        return manager.save(
          manager.create(Attendance, {
            employeeId,
            workDate,
            checkInAt,
            checkInPhotoId: photo.id,
            status: isLate(
              checkInAt,
              this.config.appTimezone,
              this.config.workStartTime,
            )
              ? AttendanceStatus.LATE
              : AttendanceStatus.ON_TIME,
            notes: input.notes ?? null,
            clientReportedAt: input.clientReportedAt
              ? new Date(input.clientReportedAt)
              : null,
            ipAddress: input.ipAddress ?? null,
            userAgent: input.userAgent?.slice(0, 500) ?? null,
          }),
        );
      });
      return AttendanceResponseDto.from(attendance);
    } catch (error) {
      await this.storage.delete(saved.storageKey);
      throw error;
    }
  }

  async checkOut(
    actor: AuthUser,
    input: CheckOutInput,
  ): Promise<AttendanceResponseDto> {
    const employeeId = await this.requireEmployeeId(actor);
    const checkOutAt = new Date();
    const workDate = toWorkDate(checkOutAt, this.config.appTimezone);

    const attendance = await this.attendances.findOneBy({
      employeeId,
      workDate,
    });
    if (!attendance) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.NOT_CHECKED_IN,
        'You have not checked in today.',
      );
    }
    if (attendance.checkOutAt) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.ALREADY_CHECKED_OUT,
        'You have already checked out today.',
      );
    }

    const saved = input.photo
      ? await this.storage.save(input.photo, this.requireImage(input.photo))
      : null;

    try {
      const updated = await this.dataSource.transaction(async (manager) => {
        const photo = saved
          ? await manager.save(
              manager.create(StoredFile, {
                storageKey: saved.storageKey,
                originalName: input.originalName ?? null,
                mimeType: saved.mimeType,
                sizeBytes: saved.sizeBytes,
                sha256: saved.sha256,
                uploadedBy: actor.id,
              }),
            )
          : null;

        return manager.save(
          manager.merge(Attendance, attendance, {
            checkOutAt,
            checkOutPhotoId: photo?.id ?? null,
          }),
        );
      });
      return AttendanceResponseDto.from(updated);
    } catch (error) {
      if (saved) await this.storage.delete(saved.storageKey);
      throw error;
    }
  }

  async findToday(actor: AuthUser): Promise<TodayAttendanceResponseDto> {
    const employeeId = await this.requireEmployeeId(actor);
    const workDate = toWorkDate(new Date(), this.config.appTimezone);

    const attendance = await this.attendances.findOneBy({
      employeeId,
      workDate,
    });

    return {
      workDate,
      checkedIn: attendance !== null,
      attendance: attendance ? AttendanceResponseDto.from(attendance) : null,
    };
  }

  async findMine(
    actor: AuthUser,
    query: MyAttendanceQueryDto,
  ): Promise<Paginated<AttendanceResponseDto>> {
    const employeeId = await this.requireEmployeeId(actor);
    const sort = parseSort(
      query.sort ?? DEFAULT_ATTENDANCE_SORT,
      ATTENDANCE_SORT_FIELDS,
    )!;

    const [rows, total] = await this.attendances.findAndCount({
      where: { employeeId, ...workDateFilter(query.from, query.to) },
      order: { [sort.field]: sort.direction, id: 'ASC' },
      skip: toOffset(query),
      take: query.limit,
    });

    return paginate(
      rows.map((row) => AttendanceResponseDto.from(row)),
      query.page,
      query.limit,
      total,
    );
  }

  async findAll(
    query: AttendanceQueryDto,
  ): Promise<Paginated<AttendanceResponseDto>> {
    const today = toWorkDate(new Date(), this.config.appTimezone);
    const from = query.from ?? today;
    const to = query.to ?? today;

    const qb = this.attendances
      .createQueryBuilder('attendance')
      .innerJoinAndSelect('attendance.employee', 'employee')
      .innerJoinAndSelect('employee.department', 'department')
      .where('attendance.workDate BETWEEN :from AND :to', { from, to });

    if (query.employeeId) {
      qb.andWhere('attendance.employeeId = :employeeId', {
        employeeId: query.employeeId,
      });
    }
    if (query.departmentId) {
      qb.andWhere('employee.departmentId = :departmentId', {
        departmentId: query.departmentId,
      });
    }
    if (query.status) {
      qb.andWhere('attendance.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        '(employee.fullName ILIKE :search OR employee.employeeNumber ILIKE :search)',
        { search: contains(query.search) },
      );
    }

    const sort = parseSort(
      query.sort ?? DEFAULT_MONITORING_SORT,
      MONITORING_SORT_FIELDS,
    )!;
    qb.orderBy(SORT_COLUMNS[sort.field], sort.direction);
    if (sort.field !== 'checkInAt') {
      qb.addOrderBy('attendance.checkInAt', 'DESC');
    }
    qb.addOrderBy('attendance.id', 'ASC');

    const [rows, total] = await qb
      .skip(toOffset(query))
      .take(query.limit)
      .getManyAndCount();

    return paginate(
      rows.map((row) => AttendanceResponseDto.withEmployee(row)),
      query.page,
      query.limit,
      total,
    );
  }

  async getSummary(date?: string): Promise<AttendanceSummaryResponseDto> {
    const workDate = date ?? toWorkDate(new Date(), this.config.appTimezone);
    const [activeEmployees, rows] = await Promise.all([
      this.employees.countActive(),
      this.attendances
        .createQueryBuilder('attendance')
        .select('attendance.status', 'status')
        .addSelect('COUNT(*)::int', 'count')
        .where('attendance.workDate = :workDate', { workDate })
        .groupBy('attendance.status')
        .getRawMany<{ status: AttendanceStatus; count: number }>(),
    ]);

    const counts: AttendanceStatusCounts = {
      [AttendanceStatus.ON_TIME]: 0,
      [AttendanceStatus.LATE]: 0,
    };
    for (const row of rows) counts[row.status] = row.count;

    return AttendanceSummaryResponseDto.from(workDate, activeEmployees, counts);
  }

  async findOne(id: string, actor: AuthUser): Promise<AttendanceResponseDto> {
    const attendance = await this.attendances.findOne({
      where: { id },
      relations: {
        employee: { user: true, department: true },
      },
    });
    if (!attendance) throw new NotFoundException();
    assertCanViewAttendance(actor, attendance.employee.userId);

    return actor.role === UserRole.HR_ADMIN
      ? AttendanceResponseDto.withEmployee(attendance)
      : AttendanceResponseDto.from(attendance);
  }

  async getPhoto(
    id: string,
    actor: AuthUser,
    kind: PhotoKind = 'checkin',
  ): Promise<PhotoStream> {
    const attendance = await this.attendances.findOne({
      where: { id },
      relations: {
        employee: { user: true },
        checkInPhoto: true,
        checkOutPhoto: true,
      },
    });
    if (!attendance) throw new NotFoundException();
    assertCanViewAttendance(actor, attendance.employee.userId);

    const photo =
      kind === 'checkout' ? attendance.checkOutPhoto : attendance.checkInPhoto;
    if (!photo) throw new NotFoundException();

    return {
      stream: await this.storage.openStream(photo.storageKey),
      mimeType: photo.mimeType,
      sizeBytes: photo.sizeBytes,
    };
  }

  private requireImage(photo: Buffer): string {
    const mimeType = detectMimeType(photo);
    if (!mimeType) {
      throw new AppException(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        ErrorCode.UNSUPPORTED_FILE_TYPE,
        'Photo must be a JPEG, PNG, or WebP image.',
      );
    }
    return mimeType;
  }

  private async requireEmployeeId(actor: AuthUser): Promise<string> {
    const employee = await this.employees.findSummaryByUserId(actor.id);
    if (!employee) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.EMPLOYEE_PROFILE_REQUIRED,
        'This account has no employee profile.',
      );
    }
    return employee.id;
  }

  private alreadySubmitted(): AppException {
    return new AppException(
      HttpStatus.CONFLICT,
      ErrorCode.ATTENDANCE_ALREADY_SUBMITTED,
      'Attendance has already been submitted for this work date.',
    );
  }
}

function workDateFilter(from?: string, to?: string) {
  if (from && to) return { workDate: Between(from, to) };
  if (from) return { workDate: MoreThanOrEqual(from) };
  if (to) return { workDate: LessThanOrEqual(to) };
  return {};
}
