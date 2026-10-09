import { Injectable } from '@nestjs/common';
import { DatabaseService } from './core/database/database.service.js';

@Injectable()
export class AppService {
  constructor(private readonly databaseService: DatabaseService) {}

  async health() {
    const database = await this.databaseService.ping();

    return {
      status: database ? 'ok' : 'degraded',
      database: database ? 'up' : 'down',
      uptime: process.uptime(),
    };
  }
}
