import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  ApiOperation,
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
import { LoginDto, LoginResponseDto, UserResponseDto } from './dto/auth.dto.js';

export const REFRESH_COOKIE = 'refresh_token';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

const MINUTE_MS = 60_000;
export const LOGIN_RATE_LIMIT = { limit: 5, ttl: MINUTE_MS };
export const REFRESH_RATE_LIMIT = { limit: 20, ttl: MINUTE_MS };

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
  @ApiOperation({
    summary: 'Log in with email and password',
    description:
      'Sets the `refresh_token` cookie (HttpOnly, SameSite=Lax, Path=/api/v1/auth). ' +
      'Every failure returns the same `INVALID_CREDENTIALS` error. Rate limited to 5 attempts per minute per IP and email.',
  })
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
  @ApiOperation({
    summary: 'Get a new access token (and a new refresh token) from the cookie',
    description:
      'Uses the `refresh_token` cookie; no body. The refresh token is a signed JWT with no server-side record: ' +
      'it stops working when it expires, or when the user is deactivated or their password changes. ' +
      'A rejected token clears the cookie.',
  })
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
  @ApiOperation({
    summary: 'Clear the refresh token cookie',
    description:
      'Idempotent; works without a bearer token. Refresh tokens are stateless, so this only ' +
      'removes the cookie: a copy of the token stays valid until it expires.',
  })
  @ApiNoContentResponse()
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The current user' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiErrorResponses([HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHENTICATED])
  me(@CurrentUser() user: AuthUser): Promise<UserResponseDto> {
    return this.auth.getSessionUser(user.id);
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
      sameSite: 'lax',
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
