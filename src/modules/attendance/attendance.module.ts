import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module.js';
import { Attendance } from '../../core/database/entities/attendance.entity.js';
import { StoredFile } from '../../core/database/entities/stored-file.entity.js';
import { StorageModule } from '../../core/storage/storage.module.js';
import { EmployeesModule } from '../employees/employees.module.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';

@Module({
  imports: [
    DatabaseModule.forFeature([Attendance, StoredFile]),
    StorageModule,
    EmployeesModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
