import { describe, expect, it } from 'vitest';
import { allowedTransitions, canTransition, isPublishTransition } from './document-transitions';

describe('máquina de estados documental (F2-T02)', () => {
  it('flujo feliz draft → in_review → published → archived', () => {
    expect(canTransition('draft', 'in_review')).toBe(true);
    expect(canTransition('in_review', 'published')).toBe(true);
    expect(canTransition('published', 'archived')).toBe(true);
  });

  it('rechaza saltos no declarados', () => {
    expect(canTransition('draft', 'published')).toBe(false);
    expect(canTransition('published', 'draft')).toBe(false);
    expect(canTransition('archived', 'published')).toBe(false);
  });

  it('archived puede reabrirse a draft; mismo estado es no-op', () => {
    expect(canTransition('archived', 'draft')).toBe(true);
    expect(canTransition('draft', 'draft')).toBe(true);
  });

  it('isPublishTransition solo detecta la llegada a published', () => {
    expect(isPublishTransition('in_review', 'published')).toBe(true);
    expect(isPublishTransition('draft', 'in_review')).toBe(false);
    expect(isPublishTransition('published', 'published')).toBe(false);
  });

  it('allowedTransitions cubre los 4 estados', () => {
    expect(allowedTransitions('draft')).toContain('in_review');
    expect(allowedTransitions('in_review')).toContain('published');
    expect(allowedTransitions('published')).toContain('archived');
  });
});
