import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppException } from '../errors/app.exception.js';
import { ErrorCode } from '../errors/error-code.js';
import type { ErrorResponseDto } from '../errors/error-response.dto.js';
import { resolveRequestId } from '../http/request-id.middleware.js';
import { asPgConstraintError, CONSTRAINT_ERROR_MAP } from './pg-error-map.js';

type ResolvedError = Pick<ErrorResponseDto, 'statusCode' | 'code' | 'message'>;

const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_FAILED,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHENTICATED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCode.FILE_TOO_LARGE,
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: ErrorCode.UNSUPPORTED_FILE_TYPE,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.TOO_MANY_REQUESTS,
};

const DEFAULT_MESSAGE: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.VALIDATION_FAILED]: 'The request is invalid.',
  [ErrorCode.UNAUTHENTICATED]: 'Authentication is required.',
  [ErrorCode.FORBIDDEN]: 'You do not have permission to perform this action.',
  [ErrorCode.NOT_FOUND]: 'Resource not found.',
  [ErrorCode.FILE_TOO_LARGE]: 'The uploaded content is too large.',
  [ErrorCode.UNSUPPORTED_FILE_TYPE]:
    'The uploaded content type is not supported.',
  [ErrorCode.TOO_MANY_REQUESTS]: 'Too many requests. Please try again later.',
  [ErrorCode.INTERNAL_ERROR]: 'An unexpected error occurred.',
};

function isMulterFileSizeError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === 'LIMIT_FILE_SIZE'
  );
}

function exposedClientErrorStatus(exception: unknown): number | undefined {
  if (typeof exception !== 'object' || exception === null) return undefined;
  const { status, expose } = exception as {
    status?: unknown;
    expose?: unknown;
  };
  return expose === true &&
    typeof status === 'number' &&
    status >= 400 &&
    status < 500
    ? status
    : undefined;
}

function internalError(
  statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
): ResolvedError {
  return {
    statusCode,
    code: ErrorCode.INTERNAL_ERROR,
    message: DEFAULT_MESSAGE[ErrorCode.INTERNAL_ERROR]!,
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    this.respond(
      exception,
      ctx.getRequest<Request>(),
      ctx.getResponse<Response>(),
    );
  }

  respond(exception: unknown, req: Request, res: Response): void {
    const requestId = req.requestId ?? resolveRequestId(undefined);

    const resolved = this.resolve(exception);
    if (resolved.statusCode >= 500) {
      this.logUnhandled(exception, resolved, req, requestId);
    }

    if (res.headersSent) return;

    const body: ErrorResponseDto = {
      ...resolved,
      timestamp: new Date().toISOString(),
    };
    res.status(resolved.statusCode).json(body);
  }

  resolve(exception: unknown): ResolvedError {
    if (isMulterFileSizeError(exception)) {
      return {
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        code: ErrorCode.FILE_TOO_LARGE,
        message: DEFAULT_MESSAGE[ErrorCode.FILE_TOO_LARGE]!,
      };
    }

    if (exception instanceof AppException) {
      return {
        statusCode: exception.getStatus(),
        code: exception.code,
        message: exception.message,
      };
    }

    const status: number | undefined =
      exception instanceof HttpException
        ? exception.getStatus()
        : exposedClientErrorStatus(exception);
    if (status !== undefined) {
      const effectiveStatus =
        status === Number(HttpStatus.METHOD_NOT_ALLOWED)
          ? HttpStatus.NOT_FOUND
          : status;
      const code = CODE_BY_STATUS[effectiveStatus];
      if (!code) return internalError(status >= 500 ? status : undefined);
      return {
        statusCode: effectiveStatus,
        code,
        message: DEFAULT_MESSAGE[code]!,
      };
    }

    const pgError = asPgConstraintError(exception);
    const mapping = pgError?.constraint
      ? CONSTRAINT_ERROR_MAP[pgError.constraint]
      : undefined;
    if (mapping) {
      return {
        statusCode: mapping.status,
        code: mapping.code,
        message: mapping.message,
      };
    }

    return internalError();
  }

  private logUnhandled(
    exception: unknown,
    resolved: ResolvedError,
    req: Request,
    requestId: string,
  ): void {
    const constraint = asPgConstraintError(exception)?.constraint;
    this.logger.error('unhandled error', exception, {
      requestId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      statusCode: resolved.statusCode,
      ...(constraint && { constraint }),
    });
  }
}
