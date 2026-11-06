import { describe, expect, it } from 'vitest';
import { HttpException, NotFoundException } from '@nestjs/common';
import type { ZodError } from 'zod';
import { z } from 'zod';
import { Problems } from '@devcycle/shared';
import { toProblem } from './problem-details.filter';
import { ProblemException } from './problem.exception';

describe('toProblem', () => {
  it('ProblemException pasa con su problem (y añade instance)', () => {
    const exception = new ProblemException(Problems.conflict('dup', 'node.code_conflict'));
    const problem = toProblem(exception, '/api/v1/x');
    expect(problem.status).toBe(409);
    expect(problem.code).toBe('node.code_conflict');
    expect(problem.instance).toBe('/api/v1/x');
  });

  it('ZodError → 400 con issues', () => {
    const schema = z.object({ name: z.string().min(1) });
    const result = schema.safeParse({ name: '' });
    expect(result.success).toBe(false);
    const problem = toProblem(result.error as ZodError, '/x');
    expect(problem.status).toBe(400);
    expect(problem.code).toBe('validation.failed');
    expect(Array.isArray(problem['issues'])).toBe(true);
  });

  it('HttpException (404 Nest) → problem http-404', () => {
    const problem = toProblem(new NotFoundException('Nodo no existe'), '/x');
    expect(problem.status).toBe(404);
    expect(problem.detail).toBe('Nodo no existe');
  });

  it('HttpException con mensaje arrayado se une', () => {
    const exception = new HttpException({ message: ['a', 'b'] }, 400);
    const problem = toProblem(exception, '/x');
    expect(problem.detail).toBe('a; b');
  });

  it('violación de unicidad PG → 409', () => {
    const problem = toProblem({ code: '23505' }, '/x');
    expect(problem.status).toBe(409);
    expect(problem.code).toBe('db.unique_violation');
  });

  it('desconocido → 500 sin filtrar internals', () => {
    const problem = toProblem(new Error('secreto interno'), '/x');
    expect(problem.status).toBe(500);
    expect(problem.code).toBe('internal.error');
    expect(problem.detail).toBeUndefined();
  });
});
