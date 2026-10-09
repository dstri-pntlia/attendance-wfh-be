import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module.js';
import { Department } from '../../core/database/entities/department.entity.js';
import { DepartmentsController } from './departments.controller.js';
import { DepartmentsService } from './departments.service.js';

@Module({
  imports: [DatabaseModule.forFeature([Department])],
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
})
export class DepartmentsModule {}
