import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from '../../core/database/entities/department.entity.js';
import { DepartmentResponseDto } from './dto/departments.dto.js';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly departments: Repository<Department>,
  ) {}

  async findAll(): Promise<DepartmentResponseDto[]> {
    const departments = await this.departments.find({ order: { name: 'ASC' } });
    return departments.map((department) =>
      DepartmentResponseDto.from(department),
    );
  }
}
