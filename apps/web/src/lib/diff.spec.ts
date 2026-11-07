import { describe, expect, it } from 'vitest';
import { diffMarkdown, diffStats } from './diff';

describe('diffMarkdown (F2-T03)', () => {
  it('detecta líneas añadidas y quitadas', () => {
    const parts = diffMarkdown('a\nb\nc', 'a\nB\nc');
    expect(parts.some((p) => p.removed && p.value.includes('b'))).toBe(true);
    expect(parts.some((p) => p.added && p.value.includes('B'))).toBe(true);
    const stats = diffStats('a\nb\nc', 'a\nB\nc');
    expect(stats.added).toBeGreaterThan(0);
    expect(stats.removed).toBeGreaterThan(0);
  });

  it('sin cambios → sin añadidas ni quitadas', () => {
    expect(diffStats('mismo\ncontenido', 'mismo\ncontenido')).toEqual({ added: 0, removed: 0 });
  });
});
