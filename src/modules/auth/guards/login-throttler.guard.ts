import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { normalizeEmail } from '../../users/users.service.js';

@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    const body = req.body as { email?: unknown } | undefined;
    const email =
      typeof body?.email === 'string'
        ? normalizeEmail(body.email).slice(0, 255)
        : '';
    return Promise.resolve(`${String(req.ip)}|${email}`);
  }
}
