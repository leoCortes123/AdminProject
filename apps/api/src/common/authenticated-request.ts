import type { Request } from 'express';

/** Usuario autenticado (forma mínima que la API expone en `req.user`). */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface ResolvedProduct {
  id: string;
  slug: string;
  name: string;
}

/** Request tras SessionGuard (+ ProductGuard en rutas `/products/:slug/*`). */
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
  session: unknown;
  product?: ResolvedProduct;
}
