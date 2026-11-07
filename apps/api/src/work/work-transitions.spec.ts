import { describe, it, expect } from 'vitest';
import { canTransition, allowedTargets, type TransitionRule } from './work-transitions';

const TASK_RULES: TransitionRule[] = [
  { fromKey: null, toKey: 'backlog' },
  { fromKey: 'backlog', toKey: 'todo' },
  { fromKey: 'todo', toKey: 'in_progress' },
  { fromKey: 'todo', toKey: 'backlog' },
  { fromKey: 'in_progress', toKey: 'in_review' },
  { fromKey: 'in_review', toKey: 'done', requiredPermission: 'tasks:write' },
  { fromKey: 'done', toKey: 'in_progress', requiresConfirmation: true },
];

describe('work-transitions (F3-T03)', () => {
  it('permite una transición declarada', () => {
    const d = canTransition(TASK_RULES, 'backlog', 'todo', ['tasks:write']);
    expect(d.allowed).toBe(true);
  });

  it('rechaza una transición no declarada (matrix)', () => {
    expect(canTransition(TASK_RULES, 'backlog', 'done', ['tasks:write']).allowed).toBe(false);
    expect(canTransition(TASK_RULES, 'todo', 'done', ['tasks:write']).allowed).toBe(false);
    expect(canTransition(TASK_RULES, 'done', 'backlog', ['tasks:write']).allowed).toBe(false);
    expect(canTransition(TASK_RULES, 'in_progress', 'done', ['tasks:write']).allowed).toBe(false);
  });

  it('exige el permiso requerido cuando la transición lo declara', () => {
    expect(canTransition(TASK_RULES, 'in_review', 'done', []).allowed).toBe(false);
    expect(canTransition(TASK_RULES, 'in_review', 'done', []).reason).toBe('falta_permiso');
    expect(canTransition(TASK_RULES, 'in_review', 'done', ['tasks:write']).allowed).toBe(true);
  });

  it('expone requires_confirmation sin bloquear', () => {
    const d = canTransition(TASK_RULES, 'done', 'in_progress', []);
    expect(d.allowed).toBe(true);
    expect(d.requiresConfirmation).toBe(true);
  });

  it('allowedTargets lista solo destinos declarados', () => {
    expect(allowedTargets(TASK_RULES, 'todo')).toEqual(['in_progress', 'backlog']);
    expect(allowedTargets(TASK_RULES, 'done')).toEqual(['in_progress']);
    expect(allowedTargets(TASK_RULES, 'cancelled')).toEqual([]);
  });
});
