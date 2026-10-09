import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiErrorResponses } from '../../common/errors/error-response.dto.js';
import { ApiPaginatedResponse } from '../../common/pagination/paginated-response.js';
import { ParseIdPipe } from '../../common/pipes/validation.pipe.js';
import { API_PREFIX } from '../../config/app.config.js';
import { UserRole } from '../../core/database/entities/user.entity.js';
import {
  type AuthUser,
  CurrentUser,
  Roles,
} from '../auth/decorators/auth.decorators.js';
import {
  CreateEmployeeDto,
  EmployeeQueryDto,
  EmployeeResponseDto,
  UpdateEmployeeDto,
  UpdateEmployeeStatusDto,
} from './dto/employees.dto.js';
import { EmployeesService } from './employees.service.js';

@ApiTags('Employees')
@ApiBearerAuth()
@ApiErrorResponses(401, 403)
@Roles(UserRole.HR_ADMIN)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @ApiPaginatedResponse(EmployeeResponseDto)
  @ApiErrorResponses(400)
  findAll(@Query() query: EmployeeQueryDto) {
    return this.employeesService.findAll(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: EmployeeResponseDto })
  @ApiErrorResponses(400, 404)
  findOne(@Param('id', ParseIdPipe) id: string) {
    return this.employeesService.findOne(id);
  }

  @Post()
  @ApiCreatedResponse({ type: EmployeeResponseDto })
  @ApiErrorResponses(400, 409, 422)
  async create(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const employee = await this.employeesService.create(dto, actor);
    res.location(`/${API_PREFIX}/employees/${employee.id}`);
    return employee;
  }

  @Patch(':id')
  @ApiOkResponse({ type: EmployeeResponseDto })
  @ApiErrorResponses(400, 404, 409, 422)
  update(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.employeesService.update(id, dto, actor);
  }

  @Patch(':id/status')
  @ApiOkResponse({ type: EmployeeResponseDto })
  @ApiErrorResponses(400, 404, 422)
  updateStatus(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateEmployeeStatusDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.employeesService.updateStatus(id, dto.status, actor);
  }
}
