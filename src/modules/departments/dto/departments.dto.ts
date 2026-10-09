import { ApiProperty } from '@nestjs/swagger';
import type { Department } from '../../../core/database/entities/department.entity.js';

export class DepartmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'ENG' })
  code: string;

  @ApiProperty({ example: 'Engineering' })
  name: string;

  static from(department: Department): DepartmentResponseDto {
    return { id: department.id, code: department.code, name: department.name };
  }
}
