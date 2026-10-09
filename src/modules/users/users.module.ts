import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module.js';
import { User } from '../../core/database/entities/user.entity.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [DatabaseModule.forFeature([User])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
