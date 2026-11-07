import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Problems } from '@devcycle/shared';
import { ProblemException } from '../common/problem.exception';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { INTEGRATION_SCOPES_KEY } from './integration-scopes.decorator';
import { IntegrationTokenService } from './integration-token.service';

/**
 * Guard de integración (F6a-T01/T02): valida `Bearer dvc_…`, el producto
 * vinculado al token (el `:slug` de la ruta debe coincidir) y los scopes
 * exigidos por `@IntegrationScopes(...)`. Adjunta `req.agent` y `req.product`.
 * No requiere sesión web: las rutas de integración llevan `@Public()` para
 * saltarse el `SessionGuard` global.
 */
@Injectable()
export class IntegrationTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: IntegrationTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required =
      this.reflector.getAllAndOverride<string[]>(INTEGRATION_SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = req.headers['authorization'];
    const raw =
      typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')
        ? auth.slice(7).trim()
        : null;
    const validated = await this.tokens.validateBearer(raw);
    this.tokens.assertRateLimit(validated.tokenId);

    // Si la ruta lleva :slug (salvo la lista /integration/products), debe ser
    // el producto del token: un token no lee productos ajenos (tenant-escape).
    const slugParam = req.params?.slug;
    const slug = Array.isArray(slugParam) ? slugParam[0] : (slugParam as string | undefined);
    if (slug && slug !== validated.slug) {
      throw new ProblemException(Problems.forbidden('El token no tiene acceso a este producto'));
    }

    const missing = required.filter((s) => !validated.scopes.includes(s));
    if (missing.length > 0) {
      throw new ProblemException(Problems.forbidden(`Scopes requeridos: ${missing.join(', ')}`));
    }

    req.agent = { ...validated };
    req.product = { id: validated.productId, slug: validated.slug, name: validated.name };
    return true;
  }
}
