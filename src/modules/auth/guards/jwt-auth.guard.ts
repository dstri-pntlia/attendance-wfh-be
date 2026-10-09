import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { UsersService } from '../../users/users.service.js';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorators.js';
import {
  type AccessTokenPayload,
  readSubjectAndVersion,
} from '../auth.tokens.js';

const BEARER = /^Bearer\s+(\S+)$/i;

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = BEARER.exec(request.headers.authorization ?? '')?.[1];
    if (!token) throw new UnauthorizedException();

    let payload: Partial<AccessTokenPayload>;
    try {
      payload = await this.jwt.verifyAsync<Partial<AccessTokenPayload>>(token);
    } catch {
      throw new UnauthorizedException();
    }
    const claims = readSubjectAndVersion(payload);
    if (!claims) throw new UnauthorizedException();

    const user = await this.users.findById(claims.sub);
    if (!user?.isActive || user.tokenVersion !== claims.ver) {
      throw new UnauthorizedException();
    }

    request.user = { id: user.id, email: user.email, role: user.role };
    return true;
  }
}
