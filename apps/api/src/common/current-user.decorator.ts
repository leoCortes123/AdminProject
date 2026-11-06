import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from './authenticated-request';

/** Inyecta el usuario autenticado (poblado por SessionGuard). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<{ user: AuthUser }>().user,
);
