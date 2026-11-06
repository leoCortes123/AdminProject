import {
  type ArgumentsHost,
  type ExceptionFilter,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { PROBLEM_TYPE_BASE, Problems, type ProblemDetails } from '@devcycle/shared';
import { ProblemException } from './problem.exception';

const STATUS_TITLES: Record<number, string> = {
  400: 'La petición no es válida',
  401: 'No autenticado',
  403: 'Prohibido',
  404: 'Recurso no encontrado',
  405: 'Método no permitido',
  409: 'Conflicto de estado',
  422: 'No se puede procesar',
  429: 'Demasiadas peticiones',
  500: 'Error interno',
  503: 'Servicio no disponible',
};

function titleFor(status: number): string {
  return STATUS_TITLES[status] ?? 'Error';
}

function isUniqueViolation(exception: unknown): boolean {
  return (
    typeof exception === 'object' &&
    exception !== null &&
    (exception as { code?: unknown }).code === '23505'
  );
}

function resolveDetail(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === 'string') return response;
  if (typeof response === 'object' && response !== null) {
    const message = (response as { message?: unknown }).message;
    if (Array.isArray(message)) return message.join('; ');
    if (typeof message === 'string') return message;
  }
  return exception.message;
}

export function toProblem(exception: unknown, url: string): ProblemDetails {
  if (exception instanceof ProblemException) {
    return { instance: url, ...exception.problem };
  }
  if (exception instanceof ZodError) {
    return {
      ...Problems.validation(undefined, {
        issues: exception.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      }),
      instance: url,
    };
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    return {
      type: `${PROBLEM_TYPE_BASE}http-${status}`,
      title: titleFor(status),
      status,
      detail: resolveDetail(exception),
      instance: url,
      code: `http.${status}`,
    };
  }
  if (isUniqueViolation(exception)) {
    return { ...Problems.conflict('El recurso ya existe', 'db.unique_violation'), instance: url };
  }
  return { ...Problems.internal(), instance: url };
}

/**
 * Filtro global: toda respuesta de error sale como `application/problem+json`
 * (RFC 9457). 5xx se loguea con stack; el cuerpo jamás filtra detalles internos.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const problem = toProblem(exception, req.url);

    if (problem.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${problem.status} ${req.method} ${req.url} — ${problem.title}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(problem.status).type('application/problem+json').json(problem);
  }
}
