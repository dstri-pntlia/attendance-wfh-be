import { NotFoundException } from '@nestjs/common';
import { UserRole } from '../../core/database/entities/user.entity.js';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter.js';
import type { AuthUser } from '../auth/decorators/auth.decorators.js';
import {
  assertCanViewAttendance,
  canViewAttendance,
} from './attendance.policy.js';

const OWNER_ID = '0b8c6a3e-6c1e-4b8e-9d0a-2f9f6c1b7a10';
const OTHER_ID = '8f2d1c34-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

const employee = (id: string): AuthUser => ({
  id,
  email: `${id}@example.com`,
  role: UserRole.EMPLOYEE,
});
const hrAdmin: AuthUser = {
  id: 'a1b2c3d4-0000-4000-8000-000000000001',
  email: 'hr@example.com',
  role: UserRole.HR_ADMIN,
};

describe('attendance ownership policy', () => {
  describe('canViewAttendance', () => {
    it.each([
      ['the owner', employee(OWNER_ID), true],
      ['another employee', employee(OTHER_ID), false],
      ['an HR admin', hrAdmin, true],
    ])('%s → %s', (_label, user, allowed) => {
      expect(canViewAttendance(user, OWNER_ID)).toBe(allowed);
    });
  });

  describe('assertCanViewAttendance', () => {
    it('lets the owner and HR admins through', () => {
      expect(() =>
        assertCanViewAttendance(employee(OWNER_ID), OWNER_ID),
      ).not.toThrow();
      expect(() => assertCanViewAttendance(hrAdmin, OWNER_ID)).not.toThrow();
    });

    it('answers 404, not 403, for another employee, so existence is not disclosed', () => {
      expect(() =>
        assertCanViewAttendance(employee(OTHER_ID), OWNER_ID),
      ).toThrow(NotFoundException);
    });

    it('answers the same 404 when the attendance does not exist', () => {
      expect(() => assertCanViewAttendance(hrAdmin, undefined)).toThrow(
        NotFoundException,
      );
      expect(() =>
        assertCanViewAttendance(employee(OWNER_ID), undefined),
      ).toThrow(NotFoundException);
    });

    it('produces the same API error for "foreign" and "missing"', () => {
      const filter = new AllExceptionsFilter();
      const asError = (fn: () => void) => {
        try {
          fn();
        } catch (error) {
          return filter.resolve(error);
        }
        throw new Error('expected an exception');
      };

      const foreign = asError(() =>
        assertCanViewAttendance(employee(OTHER_ID), OWNER_ID),
      );
      const missing = asError(() =>
        assertCanViewAttendance(employee(OTHER_ID), undefined),
      );

      expect(foreign).toEqual({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Resource not found.',
      });
      expect(missing).toEqual(foreign);
    });
  });
});
