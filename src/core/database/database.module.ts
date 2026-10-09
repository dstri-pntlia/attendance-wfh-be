import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from '../../config/app-config.service.js';
import { databaseOptions } from './data-source.js';
import { DatabaseService } from './database.service.js';

type FeatureEntities = Parameters<typeof TypeOrmModule.forFeature>[0];

@Module({})
export class DatabaseModule {
  static forRootAsync(): DynamicModule {
    return {
      module: DatabaseModule,
      imports: [
        TypeOrmModule.forRootAsync({
          inject: [AppConfigService],
          useFactory: (config: AppConfigService) => ({
            ...databaseOptions,
            url: config.databaseUrl,
            retryAttempts: 5,
            retryDelay: 2000,
          }),
        }),
      ],
      providers: [DatabaseService],
      exports: [TypeOrmModule, DatabaseService],
      global: true,
    };
  }

  static forFeature(entities: FeatureEntities): DynamicModule {
    return {
      module: DatabaseModule,
      imports: [TypeOrmModule.forFeature(entities)],
      exports: [TypeOrmModule],
    };
  }
}
