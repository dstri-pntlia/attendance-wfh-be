import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-code.js';
import { ApiErrorResponses } from '../../common/errors/error-response.dto.js';
import { AppConfigService } from '../../config/app-config.service.js';
import {
  type AuthUser,
  CurrentUser,
  Public,
} from './decorators/auth.decorators.js';
import { LoginThrottlerGuard } from './guards/login-throttler.guard.js';
import { AuthService, type AuthSession } from './auth.service.js';
import {
  ChangePasswordDto,
  LoginDto,
  LoginResponseDto,
  UserResponseDto,
} from './dto/auth.dto.js';

export const REFRESH_COOKIE = 'refresh_token';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

const MINUTE_MS = 60_000;
export const LOGIN_RATE_LIMIT = { limit: 5, ttl: MINUTE_MS };
export const REFRESH_RATE_LIMIT = { limit: 20, ttl: MINUTE_MS };
export const PASSWORD_CHANGE_RATE_LIMIT = { limit: 5, ttl: MINUTE_MS };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @UseGuards(LoginThrottlerGuard)
  @Throttle({ default: LOGIN_RATE_LIMIT })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiErrorResponses(
    [HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS],
    HttpStatus.TOO_MANY_REQUESTS,
  )
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const session = await this.auth.login(dto.email, dto.password);
    return this.respond(res, session);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: REFRESH_RATE_LIMIT })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiErrorResponses(
    [HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_REFRESH_TOKEN],
    HttpStatus.TOO_MANY_REQUESTS,
  )
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    try {
      const session = await this.auth.refresh(this.readRefreshCookie(req));
      return this.respond(res, session);
    } catch (error) {
      if (
        error instanceof AppException &&
        error.code === ErrorCode.INVALID_REFRESH_TOKEN
      ) {
        res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
      }
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiNoContentResponse()
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserResponseDto })
  @ApiErrorResponses([HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHENTICATED])
  me(@CurrentUser() user: AuthUser): Promise<UserResponseDto> {
    return this.auth.getSessionUser(user.id);
  }

  @Patch('me/password')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: PASSWORD_CHANGE_RATE_LIMIT })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    [HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHENTICATED],
    HttpStatus.TOO_MANY_REQUESTS,
  )
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  private respond(res: Response, session: AuthSession): LoginResponseDto {
    res.cookie(REFRESH_COOKIE, session.refreshToken, {
      ...this.cookieOptions(),
      maxAge: this.config.refreshTokenTtlSeconds * 1000,
    });
    return session.response;
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: this.config.cookieSecure ? 'none' : 'lax',
      secure: this.config.cookieSecure,
      path: REFRESH_COOKIE_PATH,
    };
  }

  private readRefreshCookie(req: Request): string | undefined {
    const value = (req.cookies as Record<string, unknown> | undefined)?.[
      REFRESH_COOKIE
    ];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }
}
