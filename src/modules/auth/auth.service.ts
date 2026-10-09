import { HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'node:crypto';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-code.js';
import {
  hashPassword,
  verifyPassword,
} from '../../common/utils/password.util.js';
import { AppConfigService } from '../../config/app-config.service.js';
import type { User } from '../../core/database/entities/user.entity.js';
import { EmployeesService } from '../employees/employees.service.js';
import { UsersService } from '../users/users.service.js';
import {
  type AccessTokenPayload,
  readSubjectAndVersion,
  type RefreshTokenPayload,
} from './auth.tokens.js';
import { LoginResponseDto, UserResponseDto } from './dto/auth.dto.js';

export interface AuthSession {
  response: LoginResponseDto;
  refreshToken: string;
}

const JWT_ALGORITHM = 'HS256';

const invalidCredentials = () =>
  new AppException(
    HttpStatus.UNAUTHORIZED,
    ErrorCode.INVALID_CREDENTIALS,
    'Invalid email or password.',
  );

const invalidRefreshToken = () =>
  new AppException(
    HttpStatus.UNAUTHORIZED,
    ErrorCode.INVALID_REFRESH_TOKEN,
    'Refresh token is invalid or expired.',
  );

@Injectable()
export class AuthService {
  private dummyHash: Promise<string> | undefined;

  constructor(
    private readonly users: UsersService,
    private readonly employees: EmployeesService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  async login(email: string, password: string): Promise<AuthSession> {
    const user = await this.users.findByEmailWithPasswordHash(email);
    const active = user?.isActive === true;
    const passwordOk = await verifyPassword(
      active ? user.passwordHash : await this.getDummyHash(),
      password,
    );
    if (!active || !passwordOk) throw invalidCredentials();

    await this.users.recordLogin(user.id);
    return this.issueSession(user);
  }

  async refresh(rawToken: string | undefined): Promise<AuthSession> {
    if (!rawToken) throw invalidRefreshToken();

    let payload: Partial<RefreshTokenPayload>;
    try {
      payload = await this.jwt.verifyAsync<Partial<RefreshTokenPayload>>(
        rawToken,
        {
          secret: this.config.jwtRefreshSecret,
          algorithms: [JWT_ALGORITHM],
        },
      );
    } catch {
      throw invalidRefreshToken();
    }
    const claims = readSubjectAndVersion(payload);
    if (!claims) throw invalidRefreshToken();

    const user = await this.users.findById(claims.sub);
    if (!user?.isActive || user.tokenVersion !== claims.ver) {
      throw invalidRefreshToken();
    }
    return this.issueSession(user);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.users.findByIdWithPasswordHash(userId);
    if (!user) throw new UnauthorizedException();
    if (!(await verifyPassword(user.passwordHash, currentPassword))) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.CURRENT_PASSWORD_INCORRECT,
        'The current password is incorrect.',
      );
    }
    await this.users.changePasswordAndRevokeTokens(user.id, newPassword);
  }

  async getSessionUser(userId: string): Promise<UserResponseDto> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return this.toUserResponse(user);
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
    return this.dummyHash;
  }

  private async issueSession(user: User): Promise<AuthSession> {
    return {
      response: await this.buildResponse(user),
      refreshToken: await this.signRefreshToken(user),
    };
  }

  private signRefreshToken(user: User): Promise<string> {
    const payload: RefreshTokenPayload = {
      sub: user.id,
      ver: user.tokenVersion,
      jti: randomUUID(),
    };
    return this.jwt.signAsync(payload, {
      secret: this.config.jwtRefreshSecret,
      expiresIn: this.config.refreshTokenTtlSeconds,
    });
  }

  private async buildResponse(user: User): Promise<LoginResponseDto> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      role: user.role,
      ver: user.tokenVersion,
    };
    return {
      accessToken: await this.jwt.signAsync(payload),
      expiresIn: this.config.jwtAccessTtlSeconds,
      user: await this.toUserResponse(user),
    };
  }

  private async toUserResponse(user: User): Promise<UserResponseDto> {
    const employee = await this.employees.findSummaryByUserId(user.id);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      employee: employee && {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        fullName: employee.fullName,
      },
    };
  }
}
