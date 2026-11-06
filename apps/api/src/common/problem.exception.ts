import { HttpException } from '@nestjs/common';
import type { ProblemDetails } from '@devcycle/shared';

/**
 * Excepción que transporta un `ProblemDetails` (RFC 9457) ya construido.
 * El filtro global la convierte en `application/problem+json` tal cual.
 */
export class ProblemException extends HttpException {
  constructor(readonly problem: ProblemDetails) {
    super(problem, problem.status);
  }
}
