import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module.js';
import { Employee } from '../../core/database/entities/employee.entity.js';
import { UsersModule } from '../users/users.module.js';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';

@Module({
  imports: [DatabaseModule.forFeature([Employee]), UsersModule],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
