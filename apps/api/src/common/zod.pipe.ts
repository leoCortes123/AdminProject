import { type PipeTransform, Injectable } from '@nestjs/common';
import type { ZodError } from 'zod';
import { type ZodTypeAny, type z } from 'zod';
import { Problems } from '@devcycle/shared';
import { ProblemException } from './problem.exception';

/**
 * Valida el valor entrante contra un schema zod. Los errores se traducen a
 * 400 `application/problem+json` (con `issues[]` como extensión).
 */
@Injectable()
export class ZodValidationPipe<S extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new ProblemException(
        Problems.validation(undefined, {
          issues: (result.error as ZodError).issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        }),
      );
    }
    return result.data as z.infer<S>;
  }
}

export const zodPipe = <S extends ZodTypeAny>(schema: S) => new ZodValidationPipe(schema);
