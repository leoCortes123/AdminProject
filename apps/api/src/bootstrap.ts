import 'reflect-metadata';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { toNodeHandler } from 'better-auth/node';
import type { NextFunction, Request, Response } from 'express';
import { Logger as PinoNestLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { getEnv } from './config/env';
import { auth } from './iam/auth';

/**
 * Construye y cablea la aplicación NestJS (helmet → better-auth crudo →
 * body-parser → CORS → prefijo /api/v1 → Swagger). Lo usan tanto el
 * bootstrap real (main.ts) como los tests de integración (Supertest),
 * garantizando que se prueba la app EXACTA que se despliega.
 */
export async function createNestApp(): Promise<NestExpressApplication> {
  const env = getEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // better-auth necesita el body crudo en /api/auth/*; Nest re-activa JSON después.
    bodyParser: false,
    bufferLogs: true,
  });
  app.useLogger(app.get(PinoNestLogger));

  app.use(helmet());

  // Handler crudo de better-auth MONTADO ANTES del body-parser de Nest.
  const authHandler = toNodeHandler(auth);
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/auth')) {
      void authHandler(req, res);
      return;
    }
    next();
  });
  app.useBodyParser('json');

  app.enableCors({ origin: env.WEB_URL, credentials: true });
  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('DevCycle API')
    .setDescription(
      'API de DevCycle — plataforma de gestión del ciclo de vida del software. ' +
        'Autenticación: cookie HttpOnly `better-auth.session_token` (login vía /api/auth/*). ' +
        'Errores: application/problem+json (RFC 9457).',
    )
    .setVersion('1.0')
    .addCookieAuth('better-auth.session_token')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/v1/docs', app, document);

  return app;
}
