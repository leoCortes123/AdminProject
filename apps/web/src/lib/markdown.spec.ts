import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown (F2-T04 · R-06)', () => {
  it('renderiza Markdown básico a HTML', () => {
    const html = renderMarkdown('# Título\n\nTexto **negrita**.');
    expect(html).toContain('<h1');
    expect(html).toContain('<strong>negrita</strong>');
  });

  it('no ejecuta HTML crudo: <script> no llega como etiqueta', () => {
    const html = renderMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)</script>');
  });

  it('sanitiza javascript: y on* en enlaces', () => {
    const html = renderMarkdown('[x](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    const img = renderMarkdown('![x](x.png)');
    expect(img).toContain('<img');
  });
});
