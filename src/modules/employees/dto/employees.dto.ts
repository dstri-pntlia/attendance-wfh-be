import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateBy,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto.js';
import { IsSort } from '../../../common/pagination/sort.js';
import { isCalendarDate } from '../../../common/utils/time.util.js';
import {
  type Employee,
  EmployeeStatus,
} from '../../../core/database/entities/employee.entity.js';
import { DepartmentResponseDto } from '../../departments/dto/departments.dto.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

function oneYearFromToday(): string {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function IsHireDate(): PropertyDecorator {
  return ValidateBy({
    name: 'isHireDate',
    validator: {
      validate: (value: unknown) =>
        isCalendarDate(value) && value <= oneYearFromToday(),
      defaultMessage: () =>
        '$property must be a YYYY-MM-DD date no more than 1 year in the future',
    },
  });
}

export class CreateEmployeeDto {
  @ApiProperty({ example: 'EMP-0007', minLength: 3, maxLength: 20 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z0-9-]{3,20}$/, {
    message: 'employeeNumber must be 3-20 letters, digits or "-"',
  })
  employeeNumber: string;

  @ApiProperty({ example: 'Siti Rahma', minLength: 2, maxLength: 150 })
  @Transform(trim)
  @IsString()
  @Length(2, 150)
  fullName: string;

  @ApiProperty({ example: 'siti@example.com', maxLength: 255 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({
    example: '081298765432',
    nullable: true,
    minLength: 8,
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @Length(8, 20)
  @Matches(/^\+?\d+$/, {
    message: 'phone must contain digits only, with an optional leading +',
  })
  phone?: string | null;

  @ApiProperty({ example: 'Accountant', minLength: 2, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  position: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  departmentId: string;

  @ApiProperty({ example: '2026-10-01', format: 'date' })
  @IsHireDate()
  hireDate: string;

  @ApiProperty({ example: 'Welcome123', minLength: 8, maxLength: 128 })
  @IsString()
  @Length(8, 128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'password must contain at least one letter and one digit',
  })
  password: string;
}

export class UpdateEmployeeDto extends PartialType(
  OmitType(CreateEmployeeDto, ['password'] as const),
  { skipNullProperties: false },
) {}

export class UpdateEmployeeStatusDto {
  @ApiProperty({ enum: EmployeeStatus, example: EmployeeStatus.INACTIVE })
  @IsEnum(EmployeeStatus)
  status: EmployeeStatus;
}

export const EMPLOYEE_SORT_FIELDS = [
  'fullName',
  'employeeNumber',
  'hireDate',
  'createdAt',
] as const;

export const DEFAULT_EMPLOYEE_SORT = 'fullName:asc';

export class EmployeeQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Matches full name, email, or employee number',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ enum: EmployeeStatus })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @ApiPropertyOptional({
    example: DEFAULT_EMPLOYEE_SORT,
    description: `field:asc|desc, field one of ${EMPLOYEE_SORT_FIELDS.join(', ')}`,
  })
  @IsOptional()
  @IsSort(EMPLOYEE_SORT_FIELDS)
  sort?: string;
}

export class EmployeeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'EMP-0001' })
  employeeNumber: string;

  @ApiProperty({ example: 'Budi Santoso' })
  fullName: string;

  @ApiProperty({ example: 'budi@example.com' })
  email: string;

  @ApiProperty({ example: '081234567890', nullable: true, type: String })
  phone: string | null;

  @ApiProperty({ example: 'Backend Engineer' })
  position: string;

  @ApiProperty({ type: DepartmentResponseDto })
  department: DepartmentResponseDto;

  @ApiProperty({ example: '2024-03-01', format: 'date' })
  hireDate: string;

  @ApiProperty({ enum: EmployeeStatus })
  status: EmployeeStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;

  static from(employee: Employee): EmployeeResponseDto {
    return {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      fullName: employee.fullName,
      email: employee.user.email,
      phone: employee.phone,
      position: employee.position,
      department: DepartmentResponseDto.from(employee.department),
      hireDate: employee.hireDate,
      status: employee.status,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };
  }
}
