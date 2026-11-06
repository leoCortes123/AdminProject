import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { Problems } from '@devcycle/shared';
import { ProblemException } from './problem.exception';
import type { AuthenticatedRequest, ResolvedProduct } from './authenticated-request';

/**
 * Inyecta el producto resuelto por ProductGuard (`req.product`).
 * Si la ruta no usa ProductGuard es un error de programación → 500.
 */
export const CurrentProduct = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ResolvedProduct => {
    const product = ctx.switchToHttp().getRequest<AuthenticatedRequest>().product;
    if (!product) {
      throw new ProblemException(Problems.internal('Ruta sin ProductGuard: producto no resuelto'));
    }
    return product;
  },
);
