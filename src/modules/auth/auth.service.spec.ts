import { createHmac, randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppException } from '../../common/errors/app.exception.js';
import { hashPassword } from '../../common/utils/password.util.js';
import type { AppConfigService } from '../../config/app-config.service.js';
import { User, UserRole } from '../../core/database/entities/user.entity.js';
import type { EmployeesService } from '../employees/employees.service.js';
import type { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

const PASSWORD = 'Secret123';
const ACCESS_SECRET = 'access-secret-that-is-at-least-32-characters-long';
const REFRESH_SECRET = 'refresh-secret-that-is-at-least-32-characters-long';
const REFRESH_TTL_SECONDS = 7 * 86_400;
const USER_ID = '0b8c6a3e-6c1e-4b8e-9d0a-2f9f6c1b7a10';

const now = () => Math.floor(Date.now() / 1000);

function forge(
  payload: Record<string, unknown>,
  secret: string,
  alg: 'HS256' | 'HS384' | 'none' = 'HS256',
): string {
  const part = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${part({ alg, typ: 'JWT' })}.${part(payload)}`;
  if (alg === 'none') return `${unsigned}.`;
  const signature = createHmac(alg === 'HS384' ? 'sha384' : 'sha256', secret)
    .update(unsigned)
    .digest('base64url');
  return `${unsigned}.${signature}`;
}

describe('AuthService', () => {
  let passwordHash: string;
  const users = {
    findByEmailWithPasswordHash: vi.fn(),
    findById: vi.fn(),
    findByIdWithPasswordHash: vi.fn(),
    changePasswordAndRevokeTokens: vi.fn(),
    recordLogin: vi.fn(),
  };
  const employees = { findSummaryByUserId: vi.fn() };
  const config = {
    jwtAccessTtlSeconds: 900,
    jwtRefreshSecret: REFRESH_SECRET,
    refreshTokenTtlSeconds: REFRESH_TTL_SECONDS,
  };
  const jwt = new JwtService({
    secret: ACCESS_SECRET,
    signOptions: { algorithm: 'HS256', expiresIn: 900 },
    verifyOptions: { algorithms: ['HS256'] },
  });
  let service: AuthService;

  const user = (overrides: Partial<User> = {}): User =>
    ({
      id: USER_ID,
      email: 'budi@example.com',
      role: UserRole.EMPLOYEE,
      isActive: true,
      tokenVersion: 3,
      passwordHash,
      ...overrides,
    }) as User;

  const refreshToken = (
    claims: Record<string, unknown> = {},
    secret = REFRESH_SECRET,
  ) =>
    forge(
      {
        sub: USER_ID,
        ver: 3,
        jti: randomUUID(),
        iat: now(),
        exp: now() + 600,
        ...claims,
      },
      secret,
    );

  beforeAll(async () => {
    passwordHash = await hashPassword(PASSWORD);
  });

  beforeEach(() => {
    vi.resetAllMocks();
    employees.findSummaryByUserId.mockResolvedValue(null);
    service = new AuthService(
      users as unknown as UsersService,
      employees as unknown as EmployeesService,
      jwt,
      config as unknown as AppConfigService,
    );
  });

  describe('login', () => {
    beforeEach(() => {
      users.findByEmailWithPasswordHash.mockResolvedValue(user());
    });

    it('returns the session view with an access token and the expiry in seconds', async () => {
      employees.findSummaryByUserId.mockResolvedValue({
        id: 'emp-1',
        employeeNumber: 'EMP-0001',
        fullName: 'Budi Santoso',
      });

      const { response } = await service.login('budi@example.com', PASSWORD);

      expect(response).toEqual({
        accessToken: expect.any(String),
        expiresIn: 900,
        user: {
          id: USER_ID,
          email: 'budi@example.com',
          role: 'EMPLOYEE',
          employee: {
            id: 'emp-1',
            employeeNumber: 'EMP-0001',
            fullName: 'Budi Santoso',
          },
        },
      });
      expect(users.recordLogin).toHaveBeenCalledWith(USER_ID);
    });

    it('signs the access token with only sub, role and ver', async () => {
      users.findByEmailWithPasswordHash.mockResolvedValue(
        user({ role: UserRole.HR_ADMIN, tokenVersion: 7 }),
      );

      const { response } = await service.login('hr@example.com', PASSWORD);

      const claims = await jwt.verifyAsync<Record<string, unknown>>(
        response.accessToken,
      );
      expect(Object.keys(claims).sort()).toEqual([
        'exp',
        'iat',
        'role',
        'sub',
        'ver',
      ]);
      expect(claims).toMatchObject({ sub: USER_ID, role: 'HR_ADMIN', ver: 7 });
      expect((claims.exp as number) - (claims.iat as number)).toBe(900);
    });

    it('issues a refresh token with sub, ver and a unique jti, valid for REFRESH_TOKEN_TTL_DAYS', async () => {
      const { refreshToken: token } = await service.login(
        'budi@example.com',
        PASSWORD,
      );

      const claims = await jwt.verifyAsync<Record<string, unknown>>(token, {
        secret: REFRESH_SECRET,
      });
      expect(Object.keys(claims).sort()).toEqual([
        'exp',
        'iat',
        'jti',
        'sub',
        'ver',
      ]);
      expect(claims).toMatchObject({ sub: USER_ID, ver: 3 });
      expect(claims.jti).toMatch(/^[0-9a-f-]{36}$/);
      expect((claims.exp as number) - (claims.iat as number)).toBe(
        REFRESH_TTL_SECONDS,
      );
    });

    it('signs refresh tokens with a different key than access tokens', async () => {
      const { response, refreshToken: token } = await service.login(
        'budi@example.com',
        PASSWORD,
      );
      await expect(
        jwt.verifyAsync(token, { secret: ACCESS_SECRET }),
      ).rejects.toThrow();
      await expect(
        jwt.verifyAsync(response.accessToken, { secret: REFRESH_SECRET }),
      ).rejects.toThrow();
    });

    it('gives every login its own refresh token', async () => {
      const first = await service.login('budi@example.com', PASSWORD);
      const second = await service.login('budi@example.com', PASSWORD);
      expect(second.refreshToken).not.toBe(first.refreshToken);
    });

    it('returns employee: null for a user without an employee profile', async () => {
      users.findByEmailWithPasswordHash.mockResolvedValue(
        user({ role: UserRole.HR_ADMIN }),
      );
      const { response } = await service.login('hr@example.com', PASSWORD);
      expect(response.user.employee).toBeNull();
    });

    it('fails with the same INVALID_CREDENTIALS error for an unknown email, a wrong password, and an inactive account', async () => {
      const attempts: [User | null, string][] = [
        [null, PASSWORD],
        [user(), 'WrongPassword1'],
        [user({ isActive: false }), PASSWORD],
      ];
      const failures: AppException[] = [];
      for (const [found, password] of attempts) {
        users.findByEmailWithPasswordHash.mockResolvedValue(found);
        failures.push(
          (await service
            .login('x@example.com', password)
            .catch((e: unknown) => e)) as AppException,
        );
      }

      for (const failure of failures) {
        expect(failure).toBeInstanceOf(AppException);
        expect(failure).toMatchObject({ code: 'INVALID_CREDENTIALS' });
        expect(failure.getStatus()).toBe(401);
        expect(failure.message).toBe(failures[0].message);
      }
      expect(users.recordLogin).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    const rejects = (token: string | undefined) =>
      expect(service.refresh(token)).rejects.toMatchObject({
        code: 'INVALID_REFRESH_TOKEN',
      });

    beforeEach(() => {
      users.findById.mockResolvedValue(user());
    });

    it('rejects a missing token without touching the database', async () => {
      await rejects(undefined);
      await rejects('');
      expect(users.findById).not.toHaveBeenCalled();
    });

    it('exchanges a valid refresh token for a new access token and a new refresh token', async () => {
      const old = refreshToken();

      const session = await service.refresh(old);

      expect(users.findById).toHaveBeenCalledWith(USER_ID);
      expect(session.response.user.id).toBe(USER_ID);
      expect(session.response.expiresIn).toBe(900);
      expect(
        (await jwt.verifyAsync<{ sub: string }>(session.response.accessToken))
          .sub,
      ).toBe(USER_ID);
      expect(session.refreshToken).not.toBe(old);
      await expect(
        jwt.verifyAsync(session.refreshToken, { secret: REFRESH_SECRET }),
      ).resolves.toMatchObject({ sub: USER_ID, ver: 3 });
    });

    it('carries the current token_version into the new tokens', async () => {
      users.findById.mockResolvedValue(user({ tokenVersion: 3 }));
      const session = await service.refresh(refreshToken({ ver: 3 }));
      const claims = await jwt.verifyAsync<{ ver: number }>(
        session.response.accessToken,
      );
      expect(claims.ver).toBe(3);
    });

    it.each([
      ['garbage', () => 'not.a.jwt'],
      [
        'an access token (different signing key)',
        () => refreshToken({}, ACCESS_SECRET),
      ],
      [
        'a token signed with an unknown key',
        () => refreshToken({}, 'x'.repeat(40)),
      ],
      [
        'an expired token',
        () => refreshToken({ iat: now() - 1000, exp: now() - 10 }),
      ],
      [
        'an unsigned token (alg: none)',
        () =>
          forge(
            { sub: USER_ID, ver: 3, jti: randomUUID(), exp: now() + 600 },
            REFRESH_SECRET,
            'none',
          ),
      ],
      [
        'a token using another HMAC algorithm',
        () =>
          forge(
            { sub: USER_ID, ver: 3, jti: randomUUID(), exp: now() + 600 },
            REFRESH_SECRET,
            'HS384',
          ),
      ],
      [
        'a token with a tampered payload',
        () => {
          const [header, , signature] = refreshToken().split('.');
          const body = Buffer.from(
            JSON.stringify({ sub: randomUUID(), ver: 3, exp: now() + 600 }),
          ).toString('base64url');
          return `${header}.${body}.${signature}`;
        },
      ],
    ])('rejects %s', async (_label, make) => {
      await rejects(make());
      expect(users.findById).not.toHaveBeenCalled();
    });

    it.each([
      ['without a sub', { sub: undefined }],
      ['with a sub that is not a UUID', { sub: 'not-a-uuid' }],
      ['with a numeric sub', { sub: 42 }],
      ['without ver', { ver: undefined }],
      ['with a non-numeric ver', { ver: '3' }],
    ])('rejects a signed token %s', async (_label, claims) => {
      await rejects(refreshToken(claims));
      expect(users.findById).not.toHaveBeenCalled();
    });

    it('rejects when the user no longer exists', async () => {
      users.findById.mockResolvedValue(null);
      await rejects(refreshToken());
    });

    it('rejects an inactive (deactivated) user', async () => {
      users.findById.mockResolvedValue(user({ isActive: false }));
      await rejects(refreshToken());
    });

    it.each([2, 4])(
      'rejects a token for version %i when the user is on version 3 (password change or deactivation)',
      async (ver) => {
        await rejects(refreshToken({ ver }));
      },
    );
  });

  describe('getSessionUser', () => {
    it('returns the session view without credential fields', async () => {
      users.findById.mockResolvedValue(user());
      const view = await service.getSessionUser(USER_ID);
      expect(view).toEqual({
        id: USER_ID,
        email: 'budi@example.com',
        role: 'EMPLOYEE',
        employee: null,
      });
      expect(Object.keys(view).sort()).toEqual([
        'email',
        'employee',
        'id',
        'role',
      ]);
    });

    it('rejects an unknown user', async () => {
      users.findById.mockResolvedValue(null);
      await expect(service.getSessionUser('gone')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('changePassword', () => {
    it('stores the new password and revokes tokens when the current one matches', async () => {
      users.findByIdWithPasswordHash.mockResolvedValue(user());

      await service.changePassword(USER_ID, PASSWORD, 'NewSecret456');

      expect(users.changePasswordAndRevokeTokens).toHaveBeenCalledWith(
        USER_ID,
        'NewSecret456',
      );
    });

    it('rejects a wrong current password without changing anything', async () => {
      users.findByIdWithPasswordHash.mockResolvedValue(user());

      const error = await service
        .changePassword(USER_ID, 'WrongSecret1', 'NewSecret456')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AppException);
      expect(error).toMatchObject({
        code: 'CURRENT_PASSWORD_INCORRECT',
        status: 400,
      });
      expect(users.changePasswordAndRevokeTokens).not.toHaveBeenCalled();
    });

    it('answers 401 when the user no longer exists', async () => {
      users.findByIdWithPasswordHash.mockResolvedValue(null);

      await expect(
        service.changePassword(USER_ID, PASSWORD, 'NewSecret456'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
