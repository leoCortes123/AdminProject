import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Problems, type Permission } from '@devcycle/shared';
import { ProblemException } from '../common/problem.exception';
import { PERMISSIONS_KEY } from '../common/permissions.decorator';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { IamService } from './iam.service';

/**
 * Guard de permisos granulares. Calcula los permisos efectivos del usuario:
 *  - contexto `:slug` (con ProductGuard) → permisos del rol en ese producto;
 *  - sin contexto → solo `admin_global` (todos los permisos).
 * 403 si falta cualquiera de los permisos exigidos por `@Permissions(...)`.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly iam: IamService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required =
      this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (required.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const effective = await this.iam.getEffectivePermissions(req.user.id, req.product?.id);

    const missing = required.filter((permission) => !effective.includes(permission));
    if (missing.length > 0) {
      throw new ProblemException(Problems.forbidden(`Permisos requeridos: ${missing.join(', ')}`));
    }
    return true;
  }
}
