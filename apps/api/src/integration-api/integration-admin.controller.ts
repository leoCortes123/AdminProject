import { Body, Controller, Get, HttpCode, Ip, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createServiceAccountSchema, createApiTokenSchema } from '@devcycle/shared';
import { ProductGuard } from '../iam/product.guard';
import { PermissionsGuard } from '../iam/permissions.guard';
import { Permissions } from '../common/permissions.decorator';
import { CurrentProduct } from '../common/current-product.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { zodPipe } from '../common/zod.pipe';
import type { AuthUser, ResolvedProduct } from '../common/authenticated-request';
import { IntegrationTokenService } from './integration-token.service';
import { AgentAuditService } from './agent-audit.service';

/**
 * Gestión humana de cuentas/tokens de servicio (F6a-T01): requiere sesión
 * web + permiso `integrations:manage`. El token en claro se devuelve UNA
 * sola vez en la respuesta de creación (patrón GitHub).
 */
@ApiTags('integration-admin')
@ApiCookieAuth()
@UseGuards(ProductGuard, PermissionsGuard)
@Permissions('integrations:manage')
@Controller('products/:slug/integration')
export class IntegrationAdminController {
  constructor(
    private readonly tokens: IntegrationTokenService,
    private readonly audit: AgentAuditService,
  ) {}

  @Get('service-accounts')
  @ApiOperation({ summary: 'Lista cuentas de servicio del producto' })
  listAccounts(@CurrentProduct() product: ResolvedProduct) {
    return this.tokens.listServiceAccounts(product.id);
  }

  @Post('service-accounts')
  @HttpCode(201)
  @ApiOperation({ summary: 'Crea una cuenta de servicio (p. ej. claude-code)' })
  async createAccount(
    @CurrentProduct() product: ResolvedProduct,
    @Body(zodPipe(createServiceAccountSchema))
    input: Parameters<IntegrationTokenService['createServiceAccount']>[1],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    const account = await this.tokens.createServiceAccount(product.id, input, user.id);
    if (!account) throw new Error('Insert de cuenta de servicio no devolvió fila');
    await this.audit.record({
      productId: product.id,
      serviceAccountId: account.id,
      agentName: user.email,
      toolName: 'create_service_account',
      args: { name: input.name, agentKind: input.agentKind },
      status: 'ok',
      durationMs: 0,
      ip,
    });
    return account;
  }

  @Patch('service-accounts/:accountId/disable')
  @HttpCode(200)
  @ApiOperation({ summary: 'Deshabilita una cuenta de servicio (sus tokens dejan de validar)' })
  disableAccount(
    @CurrentProduct() product: ResolvedProduct,
    @Param('accountId') accountId: string,
  ) {
    return this.tokens.disableServiceAccount(product.id, accountId);
  }

  @Get('service-accounts/:accountId/tokens')
  @ApiOperation({ summary: 'Lista tokens de una cuenta (sin secretos: solo prefijos)' })
  listTokens(@CurrentProduct() product: ResolvedProduct, @Param('accountId') accountId: string) {
    void product;
    return this.tokens.listTokens(accountId);
  }

  @Post('tokens')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Crea un token de servicio. El token en claro solo se muestra en esta respuesta.',
  })
  async createToken(
    @CurrentProduct() product: ResolvedProduct,
    @Body(zodPipe(createApiTokenSchema))
    input: Parameters<IntegrationTokenService['createToken']>[1],
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    const created = await this.tokens.createToken(product.id, input, user.id);
    await this.audit.record({
      productId: product.id,
      serviceAccountId: input.serviceAccountId,
      agentName: user.email,
      toolName: 'create_api_token',
      args: { scopes: input.scopes, label: input.label ?? '' },
      status: 'ok',
      durationMs: 0,
      ip,
    });
    return created;
  }

  @Post('tokens/:tokenId/revoke')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoca un token (revocación instantánea)' })
  revoke(@CurrentProduct() product: ResolvedProduct, @Param('tokenId') tokenId: string) {
    return this.tokens.revokeToken(product.id, tokenId);
  }

  @Get('executions')
  @ApiOperation({ summary: 'Últimas ejecuciones de agente (auditoría)' })
  executions(@CurrentProduct() product: ResolvedProduct) {
    return this.audit.listForAdmin(product.id);
  }
}
