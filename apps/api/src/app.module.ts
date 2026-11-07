import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv, getEnv } from './config/env';
import { ProblemDetailsFilter } from './common/problem-details.filter';
import { DatabaseModule } from './database.module';
import { ActivityModule } from './common/activity.module';
import { IamModule } from './iam/iam.module';
import { SessionGuard } from './iam/session.guard';
import { HealthModule } from './health/health.module';
import { ProductsModule } from './products/products.module';
import { NodesModule } from './nodes/nodes.module';
import { DocumentsModule } from './documents/documents.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { SearchModule } from './search/search.module';
import { WorkModule } from './work/work.module';
import { TraceModule } from './trace/trace.module';
import { FollowupModule } from './followup/followup.module';
import { IntegrationModule } from './integration-api/integration.module';

const env = getEnv();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.NODE_ENV === 'production' ? 'info' : 'debug',
        // No loguear secretos ni salud.
        redact: ['req.headers.cookie', 'req.headers.authorization'],
        autoLogging: {
          ignore: (req) => req.url === '/api/v1/health',
        },
      },
    }),
    DatabaseModule,
    ActivityModule,
    IamModule,
    HealthModule,
    ProductsModule,
    NodesModule,
    DocumentsModule,
    AttachmentsModule,
    SearchModule,
    WorkModule,
    TraceModule,
    FollowupModule,
    IntegrationModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class AppModule {}
