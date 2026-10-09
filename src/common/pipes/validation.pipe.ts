import {
  HttpStatus,
  ParseUUIDPipe,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { AppException } from '../errors/app.exception.js';
import { ErrorCode } from '../errors/error-code.js';

export function toValidationMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...toValidationMessages(error.children ?? []),
  ]);
}

export function createValidationException(
  errors: ValidationError[],
): AppException {
  const messages = toValidationMessages(errors);
  return new AppException(
    HttpStatus.BAD_REQUEST,
    ErrorCode.VALIDATION_FAILED,
    messages.length > 0 ? messages.join('; ') : 'Validation failed.',
  );
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    validationError: { target: false, value: false },
    exceptionFactory: createValidationException,
  });
}

export const ParseIdPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_ID,
      'The id in the path is not a valid UUID.',
    ),
});
