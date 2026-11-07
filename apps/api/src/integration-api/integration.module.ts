import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { WorkModule } from '../work/work.module';
import { TraceModule } from '../trace/trace.module';
import { FollowupModule } from '../followup/followup.module';
import { NodesModule } from '../nodes/nodes.module';
import { ProductsModule } from '../products/products.module';
import { SearchModule } from '../search/search.module';
import { IntegrationController } from './integration.controller';
import { IntegrationAdminController } from './integration-admin.controller';
import { IntegrationTokenService } from './integration-token.service';
import { IntegrationTokenGuard } from './integration-token.guard';
import { AgentAuditService } from './agent-audit.service';
import { IntegrationContextService } from './integration-context.service';

/**
 * Fase 6a · Integraciones (M-09): capa read-only para agentes/MCP.
 * Reutiliza los servicios de dominio (nodos, docs, trabajo, traza,
 * seguimiento, búsqueda) sin duplicar lógica; solo añade identidad por
 * token, scopes, rate-limit y auditoría.
 */
@Module({
  imports: [
    DocumentsModule,
    WorkModule,
    TraceModule,
    FollowupModule,
    NodesModule,
    ProductsModule,
    SearchModule,
  ],
  controllers: [IntegrationController, IntegrationAdminController],
  providers: [
    IntegrationTokenService,
    IntegrationTokenGuard,
    AgentAuditService,
    IntegrationContextService,
  ],
  exports: [IntegrationTokenService, AgentAuditService, IntegrationContextService],
})
export class IntegrationModule {}
