import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { products } from '@devcycle/db';
import { Problems } from '@devcycle/shared';
import { DB, type Database } from '../database';
import { ProblemException } from '../common/problem.exception';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { IamService } from './iam.service';

/**
 * Resuelve `:slug` → producto (404 si no existe o está borrado) y exige
 * membresía en el producto, salvo que el usuario sea `admin_global`.
 * Adjunta `req.product = { id, slug, name }`.
 */
@Injectable()
export class ProductGuard implements CanActivate {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly iam: IamService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const slugParam = req.params.slug;
    const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;

    if (!slug) {
      throw new ProblemException(Problems.validation('Falta el parámetro :slug'));
    }

    const [product] = await this.db
      .select({ id: products.id, slug: products.slug, name: products.name })
      .from(products)
      .where(and(eq(products.slug, slug), isNull(products.deletedAt)))
      .limit(1);

    if (!product) {
      throw new ProblemException(Problems.notFound('Producto', slug));
    }

    if (!(await this.iam.isAdminGlobal(req.user.id))) {
      const membership = await this.iam.getProductMembership(req.user.id, product.id);
      if (!membership) {
        throw new ProblemException(Problems.forbidden('No eres miembro de este producto'));
      }
    }

    req.product = product;
    return true;
  }
}
