import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateBy,
  type ValidationArguments,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto.js';
import { IsSort } from '../../../common/pagination/sort.js';
import {
  daysBetween,
  isCalendarDate,
} from '../../../common/utils/time.util.js';
import { API_PREFIX } from '../../../config/app.config.js';
import {
  type Attendance,
  AttendanceStatus,
} from '../../../core/database/entities/attendance.entity.js';
import { DepartmentResponseDto } from '../../departments/dto/departments.dto.js';

export type PhotoKind = 'checkin' | 'checkout';

export const MAX_RANGE_DAYS = 366;

export function IsWorkDate(): PropertyDecorator {
  return ValidateBy({
    name: 'isWorkDate',
    validator: {
      validate: isCalendarDate,
      defaultMessage: () => '$property must be a YYYY-MM-DD date',
    },
  });
}

export function IsRangeEndOf(startKey: string): PropertyDecorator {
  return ValidateBy({
    name: 'isRangeEnd',
    validator: {
      validate: (value: unknown, args?: ValidationArguments) => {
        const from = (args?.object as Record<string, unknown>)[startKey];
        if (!isCalendarDate(value) || !isCalendarDate(from)) return true;
        const span = daysBetween(from, value);
        return span >= 0 && span < MAX_RANGE_DAYS;
      },
      defaultMessage: () =>
        `$property must be on or after ${startKey}, and the range must span at most ${MAX_RANGE_DAYS} days`,
    },
  });
}

export const MONITORING_SORT_FIELDS = [
  'workDate',
  'checkInAt',
  'employeeName',
] as const;

export const DEFAULT_MONITORING_SORT = 'workDate:desc';

export const SORT_COLUMNS: Record<
  (typeof MONITORING_SORT_FIELDS)[number],
  string
> = {
  workDate: 'attendance.workDate',
  checkInAt: 'attendance.checkInAt',
  employeeName: 'employee.fullName',
};

export class AttendanceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: '2026-10-01',
    format: 'date',
    description: 'Defaults to today in the business time zone.',
  })
  @IsOptional()
  @IsWorkDate()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    format: 'date',
    description: 'Defaults to today in the business time zone.',
  })
  @IsOptional()
  @IsWorkDate()
  @IsRangeEndOf('from')
  to?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ enum: AttendanceStatus })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Matches employee full name or employee number',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    example: DEFAULT_MONITORING_SORT,
    description: `field:asc|desc, field one of ${MONITORING_SORT_FIELDS.join(', ')}`,
  })
  @IsOptional()
  @IsSort(MONITORING_SORT_FIELDS)
  sort?: string;
}

export const ATTENDANCE_SORT_FIELDS = ['workDate'] as const;
export const DEFAULT_ATTENDANCE_SORT = 'workDate:desc';

export class MyAttendanceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01', format: 'date' })
  @IsOptional()
  @IsWorkDate()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31', format: 'date' })
  @IsOptional()
  @IsWorkDate()
  @IsRangeEndOf('from')
  to?: string;

  @ApiPropertyOptional({
    example: DEFAULT_ATTENDANCE_SORT,
    description: `field:asc|desc, field one of ${ATTENDANCE_SORT_FIELDS.join(', ')}`,
  })
  @IsOptional()
  @IsSort(ATTENDANCE_SORT_FIELDS)
  sort?: string;
}

export class CheckInDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'JPEG, PNG, or WebP, at most 5 MB.',
  })
  @IsOptional()
  photo: unknown;

  @ApiPropertyOptional({ maxLength: 500, example: 'Working on sprint tickets' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Client clock, stored for audit only; never trusted.',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  clientReportedAt?: string;
}

export class CheckOutDto {
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Optional JPEG, PNG, or WebP, at most 5 MB.',
  })
  photo?: unknown;
}

export class PhotoQueryDto {
  @ApiPropertyOptional({
    enum: ['checkin', 'checkout'],
    default: 'checkin',
    description: 'Which photo of the attendance to stream.',
  })
  @IsOptional()
  @IsIn(['checkin', 'checkout'])
  type?: PhotoKind;
}

export class AttendanceEmployeeDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'EMP-0001' })
  employeeNumber: string;

  @ApiProperty({ example: 'Budi Santoso' })
  fullName: string;

  @ApiProperty({ type: DepartmentResponseDto })
  department: DepartmentResponseDto;
}

export class AttendanceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '2026-10-06', format: 'date' })
  workDate: string;

  @ApiProperty({ format: 'date-time' })
  checkInAt: Date;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  checkOutAt: Date | null;

  @ApiProperty({ enum: AttendanceStatus })
  status: AttendanceStatus;

  @ApiProperty({ nullable: true, type: String, maxLength: 500 })
  notes: string | null;

  @ApiProperty({
    example: '/api/v1/attendances/c7e4b2a1-3d5f-4e6a-8b9c-1d2e3f4a5b6c/photo',
    description: 'Server-relative path; still requires the bearer token.',
  })
  photoUrl: string;

  @ApiPropertyOptional({ type: AttendanceEmployeeDto })
  employee?: AttendanceEmployeeDto;

  static from(attendance: Attendance): AttendanceResponseDto {
    return {
      id: attendance.id,
      workDate: attendance.workDate,
      checkInAt: attendance.checkInAt,
      checkOutAt: attendance.checkOutAt,
      status: attendance.status,
      notes: attendance.notes,
      photoUrl: `/${API_PREFIX}/attendances/${attendance.id}/photo`,
    };
  }

  static withEmployee(attendance: Attendance): AttendanceResponseDto {
    const { employee } = attendance;
    return {
      ...AttendanceResponseDto.from(attendance),
      employee: {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        fullName: employee.fullName,
        department: DepartmentResponseDto.from(employee.department),
      },
    };
  }
}

export class TodayAttendanceResponseDto {
  @ApiProperty({ example: '2026-10-06', format: 'date' })
  workDate: string;

  @ApiProperty()
  checkedIn: boolean;

  @ApiProperty({ type: AttendanceResponseDto, nullable: true })
  attendance: AttendanceResponseDto | null;
}
