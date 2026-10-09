import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses } from '../../common/errors/error-response.dto.js';
import { DepartmentsService } from './departments.service.js';
import { DepartmentResponseDto } from './dto/departments.dto.js';

@ApiTags('Departments')
@ApiBearerAuth()
@ApiErrorResponses(401)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @ApiOkResponse({ type: [DepartmentResponseDto] })
  findAll(): Promise<DepartmentResponseDto[]> {
    return this.departmentsService.findAll();
  }
}
