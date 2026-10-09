import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-code.js';

export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message, status);
  }
}
