import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiProperty,
  getSchemaPath,
} from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 57 })
  total: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMetaDto;
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMetaDto {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

export function paginate<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
): Paginated<T> {
  return { data, meta: buildPaginationMeta(page, limit, total) };
}

export function ApiPaginatedResponse(
  model: Type<unknown>,
  description?: string,
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiExtraModels(PaginationMetaDto, model),
    ApiOkResponse({
      description,
      schema: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          meta: { $ref: getSchemaPath(PaginationMetaDto) },
        },
      },
    }),
  );
}
