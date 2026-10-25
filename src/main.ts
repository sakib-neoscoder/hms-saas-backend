import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable graceful shutdown lifecycle hooks (calls OnApplicationShutdown on DatabaseModule & RedisService)
  app.enableShutdownHooks();

  // Security Headers
  app.use(helmet());

  // CORS Configuration: origin: true dynamically mirrors request origin when credentials: true
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global Prefix
  app.setGlobalPrefix('api');

  // Global Validation Pipe with strict class-validator settings
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger API Documentation Setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Hospital Management System API')
    .setDescription(
      'Production-grade Multi-Tenant SaaS Backend for Clinics and Diagnostic Centers in Bangladesh (Sprint 1: Foundation & Core Schema)',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-clinic-id',
        in: 'header',
        description: 'Multi-Tenant Clinic ID header for tenant-scoped operations',
      },
      'x-clinic-id',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 8000);

  await app.listen(port);
  logger.log(`Server listening on port ${port} [Environment: ${configService.get('NODE_ENV')}]`);
  logger.log(`API Documentation available at: http://localhost:${port}/api/docs`);
}

bootstrap();
