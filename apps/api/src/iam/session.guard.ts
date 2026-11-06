import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import { Problems } from '@devcycle/shared';
import { ProblemException } from '../common/problem.exception';
import { IS_PUBLIC_KEY } from '../common/public.decorator';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { auth } from './auth';

/**
 * Guard global: exige sesión válida (cookie HttpOnly de better-auth) salvo
 * en rutas `@Public()`. Adjunta `req.user` y `req.session`.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      throw new ProblemException(Problems.unauthenticated('Sesión no válida o expirada'));
    }

    req.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    };
    req.session = session.session;
    return true;
  }
}
