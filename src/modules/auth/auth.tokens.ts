import { isUUID } from 'class-validator';
import type { UserRole } from '../../core/database/entities/user.entity.js';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  ver: number;
}

export interface RefreshTokenPayload {
  sub: string;
  ver: number;
  jti: string;
}

export function readSubjectAndVersion(payload: {
  sub?: unknown;
  ver?: unknown;
}): { sub: string; ver: number } | null {
  const { sub, ver } = payload;
  if (typeof sub !== 'string' || !isUUID(sub) || typeof ver !== 'number') {
    return null;
  }
  return { sub, ver };
}
