import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/errors/error-response.dto.js';
import { PaginationMetaDto } from '../common/pagination/paginated-response.js';
import { SWAGGER_JSON_PATH, SWAGGER_PATH } from '../common/http/security.js';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Dexa WFH Attendance API')
    .setDescription('REST API for WFH attendance and employee management.')
    .setVersion('v1')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .addCookieAuth('refresh_token')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [ErrorResponseDto, PaginationMetaDto],
  });

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    jsonDocumentUrl: SWAGGER_JSON_PATH,
    useGlobalPrefix: false,
    swaggerOptions: { persistAuthorization: true },
  });
}
