import 'reflect-metadata';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));

  const config = app.get(ConfigService);
  const port = config.get<number>('app.port', 3000);
  const globalPrefix = config.get<string>('app.globalPrefix', 'api/v1');

  app.setGlobalPrefix(globalPrefix);
  app.enableVersioning({ type: VersioningType.URI });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());

  // Reflector is required for class-level metadata composition.
  app.get(Reflector);

  if (config.get<string>('app.env') !== 'production') {
    const swagger = new DocumentBuilder()
      .setTitle('EduTrack API')
      .setDescription('EduTrack v1 API — timetable-first scheduling backend')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swagger);
    SwaggerModule.setup(`${globalPrefix}/docs`, app, document);
  }

  app.enableShutdownHooks();
  app.enableCors({ origin: true, credentials: true });

  await app.listen(port);
}

bootstrap();
