import { NotFoundException } from '@nestjs/common';
import { UserRole } from '../../core/database/entities/user.entity.js';
import type { AuthUser } from '../auth/decorators/auth.decorators.js';

export function canViewAttendance(
  user: AuthUser,
  ownerUserId: string,
): boolean {
  return user.role === UserRole.HR_ADMIN || user.id === ownerUserId;
}

export function assertCanViewAttendance(
  user: AuthUser,
  ownerUserId: string | undefined,
): void {
  if (!ownerUserId || !canViewAttendance(user, ownerUserId)) {
    throw new NotFoundException();
  }
}
