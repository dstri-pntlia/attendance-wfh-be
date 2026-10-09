import {
  type ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { JwtService } from '@nestjs/jwt';
import {
  type User,
  UserRole,
} from '../../../core/database/entities/user.entity.js';
import type { UsersService } from '../../users/users.service.js';
import {
  type AuthUser,
  IS_PUBLIC_KEY,
  ROLES_KEY,
} from '../decorators/auth.decorators.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { LoginThrottlerGuard } from './login-throttler.guard.js';
import { RolesGuard } from './roles.guard.js';

const USER_ID = '0b8c6a3e-6c1e-4b8e-9d0a-2f9f6c1b7a10';

interface FakeRequest {
  headers: { authorization?: string };
  user?: AuthUser;
  body?: unknown;
  ip?: string;
}

function createContext(
  request: FakeRequest,
  metadata: {
    public?: boolean;
    roles?: UserRole[];
    classRoles?: UserRole[];
  } = {},
): ExecutionContext {
  const handler = () => undefined;
  class Controller {}
  if (metadata.public) Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
  if (metadata.roles)
    Reflect.defineMetadata(ROLES_KEY, metadata.roles, handler);
  if (metadata.classRoles) {
    Reflect.defineMetadata(ROLES_KEY, metadata.classRoles, Controller);
  }
  return {
    getHandler: () => handler,
    getClass: () => Controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const activeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: USER_ID,
    email: 'budi@example.com',
    role: UserRole.EMPLOYEE,
    isActive: true,
    tokenVersion: 3,
    ...overrides,
  }) as User;

describe('JwtAuthGuard', () => {
  const verifyAsync = vi.fn();
  const findById = vi.fn();
  const guard = new JwtAuthGuard(
    new Reflector(),
    { verifyAsync } as unknown as JwtService,
    { findById } as unknown as UsersService,
  );
  const request = (authorization?: string): FakeRequest => ({
    headers: { authorization },
  });

  beforeEach(() => {
    verifyAsync.mockReset().mockResolvedValue({ sub: USER_ID, ver: 3 });
    findById.mockReset().mockResolvedValue(activeUser());
  });

  it('lets @Public routes through without looking at the token', async () => {
    const req = request();
    await expect(
      guard.canActivate(createContext(req, { public: true })),
    ).resolves.toBe(true);
    expect(verifyAsync).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it.each([
    undefined,
    '',
    'Bearer',
    'Bearer ',
    'Basic dXNlcjpwYXNz',
    'Bearer two tokens',
    'token-without-scheme',
  ])('rejects the Authorization header %j', async (header) => {
    await expect(
      guard.canActivate(createContext(request(header))),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects a token that fails verification (bad signature, expired, wrong algorithm)', async () => {
    verifyAsync.mockRejectedValue(new Error('jwt expired'));
    await expect(
      guard.canActivate(createContext(request('Bearer abc.def.ghi'))),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findById).not.toHaveBeenCalled();
  });

  it.each([
    [{}],
    [{ sub: USER_ID }],
    [{ ver: 3 }],
    [{ sub: 42, ver: 3 }],
    [{ sub: 'not-a-uuid', ver: 3 }],
    [{ sub: '1 OR 1=1', ver: 3 }],
    [{ sub: USER_ID, ver: '3' }],
  ])(
    'rejects verified claims %j that lack a UUID sub or a numeric ver',
    async (claims) => {
      verifyAsync.mockResolvedValue(claims);
      await expect(
        guard.canActivate(createContext(request('Bearer abc'))),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(findById).not.toHaveBeenCalled();
    },
  );

  it('rejects when the user no longer exists', async () => {
    findById.mockResolvedValue(null);
    await expect(
      guard.canActivate(createContext(request('Bearer abc'))),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an inactive account, even with an otherwise valid token', async () => {
    findById.mockResolvedValue(activeUser({ isActive: false }));
    await expect(
      guard.canActivate(createContext(request('Bearer abc'))),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([2, 4])(
    'rejects token version %i when the user is on version 3',
    async (ver) => {
      verifyAsync.mockResolvedValue({ sub: USER_ID, ver });
      await expect(
        guard.canActivate(createContext(request('Bearer abc'))),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );

  it('attaches the database-loaded user and ignores the role claim in the token', async () => {
    verifyAsync.mockResolvedValue({ sub: USER_ID, ver: 3, role: 'HR_ADMIN' });
    const req = request('Bearer abc');

    await expect(guard.canActivate(createContext(req))).resolves.toBe(true);

    expect(req.user).toEqual({
      id: USER_ID,
      email: 'budi@example.com',
      role: UserRole.EMPLOYEE,
    });
    expect(findById).toHaveBeenCalledWith(USER_ID);
  });

  it('accepts the Bearer scheme in any letter case', async () => {
    await expect(
      guard.canActivate(createContext(request('bearer abc'))),
    ).resolves.toBe(true);
  });
});

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  const as = (role: UserRole): FakeRequest => ({
    headers: {},
    user: { id: 'u', email: 'u@example.com', role },
  });

  it('allows routes without @Roles, authenticated or not', () => {
    expect(guard.canActivate(createContext({ headers: {} }))).toBe(true);
  });

  it('allows a user whose role is listed', () => {
    expect(
      guard.canActivate(
        createContext(as(UserRole.HR_ADMIN), { roles: [UserRole.HR_ADMIN] }),
      ),
    ).toBe(true);
  });

  it('forbids a user whose role is not listed', () => {
    expect(() =>
      guard.canActivate(
        createContext(as(UserRole.EMPLOYEE), { roles: [UserRole.HR_ADMIN] }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('supports several roles and class-level @Roles', () => {
    const context = createContext(as(UserRole.EMPLOYEE), {
      classRoles: [UserRole.EMPLOYEE, UserRole.HR_ADMIN],
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('lets handler-level @Roles override class-level @Roles', () => {
    const context = createContext(as(UserRole.EMPLOYEE), {
      classRoles: [UserRole.EMPLOYEE],
      roles: [UserRole.HR_ADMIN],
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('treats a missing user on a role-restricted route as unauthenticated', () => {
    expect(() =>
      guard.canActivate(
        createContext({ headers: {} }, { roles: [UserRole.HR_ADMIN] }),
      ),
    ).toThrow(UnauthorizedException);
  });
});

describe('LoginThrottlerGuard tracker', () => {
  const guard = Object.create(LoginThrottlerGuard.prototype) as {
    getTracker(req: Record<string, unknown>): Promise<string>;
  };

  it('keys by IP and normalized email', async () => {
    expect(
      await guard.getTracker({
        ip: '10.0.0.1',
        body: { email: ' Budi@Example.com ' },
      }),
    ).toBe('10.0.0.1|budi@example.com');
  });

  it('gives the same key regardless of email case or padding', async () => {
    const a = await guard.getTracker({
      ip: '10.0.0.1',
      body: { email: 'A@x.com' },
    });
    const b = await guard.getTracker({
      ip: '10.0.0.1',
      body: { email: '  a@X.COM' },
    });
    expect(a).toBe(b);
  });

  it('separates different IPs and different emails', async () => {
    const base = await guard.getTracker({
      ip: '10.0.0.1',
      body: { email: 'a@x.com' },
    });
    expect(
      await guard.getTracker({ ip: '10.0.0.2', body: { email: 'a@x.com' } }),
    ).not.toBe(base);
    expect(
      await guard.getTracker({ ip: '10.0.0.1', body: { email: 'b@x.com' } }),
    ).not.toBe(base);
  });

  it.each([undefined, null, {}, { email: 42 }, { email: ['a@x.com'] }])(
    'falls back to the IP alone for body %j',
    async (body) => {
      expect(await guard.getTracker({ ip: '10.0.0.1', body })).toBe(
        '10.0.0.1|',
      );
    },
  );

  it('caps the email length so a huge body cannot bloat the key', async () => {
    const key = await guard.getTracker({
      ip: '10.0.0.1',
      body: { email: 'a'.repeat(10_000) },
    });
    expect(key.length).toBeLessThan(300);
  });
});
