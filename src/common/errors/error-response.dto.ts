import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiResponse } from '@nestjs/swagger';
import { ErrorCode } from './error-code.js';

export class ErrorResponseDto {
  @ApiProperty({ example: 409 })
  statusCode: number;

  @ApiProperty({
    enum: Object.values(ErrorCode),
    enumName: 'ErrorCode',
    example: ErrorCode.EMPLOYEE_EMAIL_TAKEN,
  })
  code: ErrorCode;

  @ApiProperty({ example: 'Email is already in use.' })
  message: string;

  @ApiProperty({ example: '2026-10-06T02:15:00.000Z' })
  timestamp: string;
}

export type ApiErrorStatus =
  number | readonly [status: number, code: ErrorCode];

export function ApiErrorResponses(
  ...statuses: ApiErrorStatus[]
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ...statuses.map((entry) => {
      const [status, code] =
        typeof entry === 'number' ? ([entry, undefined] as const) : entry;
      return ApiResponse({
        status,
        type: ErrorResponseDto,
        ...(code && { description: `\`${code}\`` }),
      });
    }),
  );
}
