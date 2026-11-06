/**
 * Errores RFC 9457 (application/problem+json).
 * Compartidos entre API, web y mcp-server: un único formato de error en toda la plataforma.
 */

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  /** Código de error estable y máquina-legible, p. ej. `node.code_conflict`. */
  code?: string;
  [extension: string]: unknown;
}

export const PROBLEM_TYPE_BASE = 'https://devcycle.app/problems/';

export function problem(
  type: string,
  status: number,
  title: string,
  detail?: string,
  code?: string,
  extensions?: Record<string, unknown>,
): ProblemDetails {
  return {
    type: `${PROBLEM_TYPE_BASE}${type}`,
    title,
    status,
    ...(detail !== undefined ? { detail } : {}),
    ...(code !== undefined ? { code } : {}),
    ...extensions,
  };
}

export const Problems = {
  validation: (detail?: string, extensions?: Record<string, unknown>) =>
    problem('validation', 400, 'La petición no es válida', detail, 'validation.failed', extensions),
  unauthenticated: (detail = 'Se requiere autenticación') =>
    problem('unauthenticated', 401, 'No autenticado', detail, 'auth.required'),
  forbidden: (detail = 'No tienes permiso para esta operación') =>
    problem('forbidden', 403, 'Prohibido', detail, 'auth.forbidden'),
  notFound: (entity: string, id?: string) =>
    problem(
      'not-found',
      404,
      'Recurso no encontrado',
      id ? `${entity} '${id}' no existe` : `${entity} no encontrado`,
      'not_found',
    ),
  conflict: (detail: string, code = 'conflict') =>
    problem('conflict', 409, 'Conflicto de estado', detail, code),
  unprocessable: (detail: string) =>
    problem('unprocessable', 422, 'No se puede procesar', detail, 'unprocessable'),
  internal: (detail?: string) =>
    problem('internal', 500, 'Error interno', detail, 'internal.error'),
} as const;
