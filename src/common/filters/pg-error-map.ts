import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../errors/error-code.js';

export const PG_UNIQUE_VIOLATION = '23505';
export const PG_FOREIGN_KEY_VIOLATION = '23503';

export interface ConstraintErrorMapping {
  status: HttpStatus;
  code: ErrorCode;
  message: string;
}

export const CONSTRAINT_ERROR_MAP: Readonly<
  Record<string, ConstraintErrorMapping>
> = {
  uq_users_email: {
    status: HttpStatus.CONFLICT,
    code: ErrorCode.EMPLOYEE_EMAIL_TAKEN,
    message: 'Email is already in use.',
  },
  uq_employees_employee_number: {
    status: HttpStatus.CONFLICT,
    code: ErrorCode.EMPLOYEE_NUMBER_TAKEN,
    message: 'Employee number is already in use.',
  },
  uq_attendances_employee_work_date: {
    status: HttpStatus.CONFLICT,
    code: ErrorCode.ATTENDANCE_ALREADY_SUBMITTED,
    message: 'Attendance has already been submitted for this work date.',
  },
  fk_employees_department_id: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    code: ErrorCode.DEPARTMENT_NOT_FOUND,
    message: 'Department does not exist.',
  },
};

export interface PgConstraintError {
  code: typeof PG_UNIQUE_VIOLATION | typeof PG_FOREIGN_KEY_VIOLATION;
  constraint: string | undefined;
}

export function asPgConstraintError(error: unknown): PgConstraintError | null {
  if (typeof error !== 'object' || error === null) return null;
  const candidate =
    'driverError' in error &&
    typeof error.driverError === 'object' &&
    error.driverError !== null
      ? error.driverError
      : error;
  const { code, constraint } = candidate as {
    code?: unknown;
    constraint?: unknown;
  };
  if (code !== PG_UNIQUE_VIOLATION && code !== PG_FOREIGN_KEY_VIOLATION) {
    return null;
  }
  return {
    code,
    constraint: typeof constraint === 'string' ? constraint : undefined,
  };
}
