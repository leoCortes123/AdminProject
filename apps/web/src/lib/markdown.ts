import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';

/**
 * Render Markdown → HTML seguro (F2-T04 · R-06): `allowDangerousHtml: false`
 * quiere decir que el HTML crudo del autor NUNCA se interpreta como HTML;
 * `rehype-sanitize` elimina además cualquier `javascript:`/`on*` residual.
 * Función pura (sin React) para poder unit-testearla en vitest.
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeStringify);

export function renderMarkdown(source: string): string {
  const file = processor.processSync(source);
  return String(file);
}

/** Resumen de una línea para lists (sin renderizar): primeras 160 chars. */
export function markdownExcerpt(source: string): string {
  const oneLine = source.replace(/\s+/g, ' ').trim();
  return oneLine.length > 160 ? `${oneLine.slice(0, 160)}…` : oneLine;
}
