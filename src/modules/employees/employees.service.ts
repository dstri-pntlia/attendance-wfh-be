import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-code.js';
import {
  paginate,
  type Paginated,
} from '../../common/pagination/paginated-response.js';
import { toOffset } from '../../common/pagination/pagination-query.dto.js';
import { parseSort } from '../../common/pagination/sort.js';
import { contains } from '../../common/utils/like.util.js';
import {
  Employee,
  EmployeeStatus,
} from '../../core/database/entities/employee.entity.js';
import { UserRole } from '../../core/database/entities/user.entity.js';
import type { AuthUser } from '../auth/decorators/auth.decorators.js';
import { UsersService } from '../users/users.service.js';
import {
  type CreateEmployeeDto,
  DEFAULT_EMPLOYEE_SORT,
  EMPLOYEE_SORT_FIELDS,
  type EmployeeQueryDto,
  EmployeeResponseDto,
  type UpdateEmployeeDto,
} from './dto/employees.dto.js';

export interface EmployeeSummary {
  id: string;
  employeeNumber: string;
  fullName: string;
}

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employees: Repository<Employee>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly users: UsersService,
  ) {}

  async findAll(
    query: EmployeeQueryDto,
  ): Promise<Paginated<EmployeeResponseDto>> {
    const qb = this.employees
      .createQueryBuilder('employee')
      .innerJoinAndSelect('employee.user', 'user')
      .innerJoinAndSelect('employee.department', 'department');

    if (query.search) {
      qb.andWhere(
        '(employee.fullName ILIKE :search OR employee.employeeNumber ILIKE :search OR user.email ILIKE :search)',
        { search: contains(query.search) },
      );
    }
    if (query.departmentId) {
      qb.andWhere('employee.departmentId = :departmentId', {
        departmentId: query.departmentId,
      });
    }
    if (query.status) {
      qb.andWhere('employee.status = :status', { status: query.status });
    }

    const sort = parseSort(
      query.sort ?? DEFAULT_EMPLOYEE_SORT,
      EMPLOYEE_SORT_FIELDS,
    )!;
    const [rows, total] = await qb
      .orderBy(`employee.${sort.field}`, sort.direction)
      .addOrderBy('employee.id', 'ASC')
      .skip(toOffset(query))
      .take(query.limit)
      .getManyAndCount();

    return paginate(
      rows.map((employee) => EmployeeResponseDto.from(employee)),
      query.page,
      query.limit,
      total,
    );
  }

  async findOne(id: string): Promise<EmployeeResponseDto> {
    const employee = await this.employees.findOne({
      where: { id },
      relations: { user: true, department: true },
    });
    if (!employee) throw new NotFoundException();
    return EmployeeResponseDto.from(employee);
  }

  countActive(): Promise<number> {
    return this.employees.countBy({ status: EmployeeStatus.ACTIVE });
  }

  findSummaryByUserId(userId: string): Promise<EmployeeSummary | null> {
    return this.employees.findOne({
      where: { userId },
      select: { id: true, employeeNumber: true, fullName: true },
    });
  }

  async create(
    dto: CreateEmployeeDto,
    actor: AuthUser,
  ): Promise<EmployeeResponseDto> {
    const id = await this.dataSource.transaction(async (manager) => {
      const user = await this.users.create(
        { email: dto.email, password: dto.password, role: UserRole.EMPLOYEE },
        manager,
      );
      const employee = manager.create(Employee, {
        userId: user.id,
        employeeNumber: dto.employeeNumber,
        fullName: dto.fullName,
        phone: dto.phone ?? null,
        position: dto.position,
        departmentId: dto.departmentId,
        hireDate: dto.hireDate,
        status: EmployeeStatus.ACTIVE,
        createdBy: actor.id,
        updatedBy: actor.id,
      });
      await manager.save(employee);
      return employee.id;
    });
    return this.findOne(id);
  }

  async update(
    id: string,
    dto: UpdateEmployeeDto,
    actor: AuthUser,
  ): Promise<EmployeeResponseDto> {
    const { email, ...fields } = dto;
    const changes = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    );
    if (email === undefined && Object.keys(changes).length === 0) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_FAILED,
        'At least one field must be provided.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const employee = await this.findForUpdate(manager, id);
      if (email !== undefined) {
        await this.users.changeEmail(employee.userId, email, manager);
      }
      await manager.update(
        Employee,
        { id },
        { ...changes, updatedBy: actor.id },
      );
    });
    return this.findOne(id);
  }

  async updateStatus(
    id: string,
    status: EmployeeStatus,
    actor: AuthUser,
  ): Promise<EmployeeResponseDto> {
    await this.dataSource.transaction(async (manager) => {
      const employee = await this.findForUpdate(manager, id);
      if (status === EmployeeStatus.INACTIVE && employee.userId === actor.id) {
        throw new AppException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          ErrorCode.CANNOT_DEACTIVATE_SELF,
          'You cannot deactivate your own account.',
        );
      }
      if (employee.status === status) return;

      await manager.update(Employee, { id }, { status, updatedBy: actor.id });
      await this.users.setActive(
        employee.userId,
        status === EmployeeStatus.ACTIVE,
        manager,
      );
      if (status === EmployeeStatus.INACTIVE) {
        await this.users.bumpTokenVersion(employee.userId, manager);
      }
    });
    return this.findOne(id);
  }

  private async findForUpdate(
    manager: EntityManager,
    id: string,
  ): Promise<Employee> {
    const employee = await manager.findOne(Employee, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!employee) throw new NotFoundException();
    return employee;
  }
}
