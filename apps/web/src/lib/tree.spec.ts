import { describe, expect, it } from 'vitest';
import { buildTree, computeModuleProgress } from './tree';
import { timeAgo, initials } from './format';
import type { ProductNode } from './types';

const node = (
  id: string,
  parentId: string | null,
  code: string,
  typeKey: string,
  position: number,
  status: ProductNode['status'] = 'planned',
): ProductNode => ({
  id,
  parentId,
  code,
  name: code,
  path: code.toLowerCase().replace(/-/g, '_'),
  depth: 0,
  position,
  status,
  ownerId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  nodeType: { key: typeKey, label: typeKey, color: '#6366f1', icon: null },
});

describe('buildTree', () => {
  it('anida hijos y ordena por posición', () => {
    const flat = [
      node('a', null, 'MOD-02', 'modulo', 1),
      node('b', null, 'MOD-01', 'modulo', 0),
      node('c', 'a', 'PANT-02', 'pantalla', 1),
      node('d', 'a', 'PANT-01', 'pantalla', 0),
    ];
    const tree = buildTree(flat);
    expect(tree.map((n) => n.code)).toEqual(['MOD-01', 'MOD-02']);
    expect(tree[1]?.children?.map((n) => n.code)).toEqual(['PANT-01', 'PANT-02']);
  });

  it('huérfanos (parentId inexistente) se adjuntan a la raíz sin romper', () => {
    const flat = [node('x', 'fantasma', 'MOD-01', 'modulo', 0)];
    const tree = buildTree(flat);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe('x');
  });

  it('lista vacía → árbol vacío', () => {
    expect(buildTree([])).toEqual([]);
  });
});

describe('computeModuleProgress', () => {
  it('calcula % de descendientes hechos por módulo', () => {
    const flat = [
      node('m', null, 'MOD-01', 'modulo', 0),
      node('p1', 'm', 'PANT-01', 'pantalla', 0, 'done'),
      node('p2', 'm', 'PANT-02', 'pantalla', 1, 'planned'),
      node('c1', 'p1', 'COMP-01', 'componente', 0, 'done'),
    ];
    const progress = computeModuleProgress(flat);
    expect(progress).toHaveLength(1);
    expect(progress[0]).toMatchObject({ code: 'MOD-01', total: 3, done: 2, pct: 67 });
  });

  it('módulo sin descendientes → 0%', () => {
    const flat = [node('m', null, 'MOD-03', 'modulo', 0)];
    expect(computeModuleProgress(flat)[0]).toMatchObject({ total: 0, done: 0, pct: 0 });
  });

  it('ignora no-módulos', () => {
    const flat = [node('p', null, 'PANT-01', 'pantalla', 0)];
    expect(computeModuleProgress(flat)).toEqual([]);
  });
});

describe('timeAgo / initials', () => {
  it('timeAgo traduce a español humano', () => {
    const now = Date.parse('2026-11-06T12:00:00.000Z');
    expect(timeAgo('2026-11-06T11:59:10.000Z', now)).toBe('ahora mismo');
    expect(timeAgo('2026-11-06T11:30:00.000Z', now)).toBe('hace 30 min');
    expect(timeAgo('2026-11-06T09:00:00.000Z', now)).toBe('hace 3 h');
    expect(timeAgo('2026-11-03T12:00:00.000Z', now)).toBe('hace 3 d');
  });

  it('initials con nombres compuestos', () => {
    expect(initials('Leonardo Gutiérrez')).toBe('LG');
    expect(initials('María')).toBe('M');
  });
});
