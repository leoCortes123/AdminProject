/**
 * Sanitización de SVG (F2-T05, 03 §4.7 / R-06): el SVG es XML activo
 * (script, event handlers, `javascript:`) y se sirve con `Attachment`.
 * Estrategia: allowlist conductual — se RECHAZA cualquier SVG con vectores
 * conocidos. Los diagramas limpios (rect, path, text…) pasan.
 */
const DANGEROUS_PATTERNS: readonly RegExp[] = [
  /<script\b/i,
  /<foreignObject\b/i,
  /<iframe\b/i,
  /<object\b/i,
  /<embed\b/i,
  /<applet\b/i,
  /<base\b/i,
  /<link\b/i,
  /<meta\b/i,
  /<style\b/i, // CSS incrustado puede exfiltrar vía url()
  /<animate\b/i, // SMIL puede reescribir atributos (onclick vía set)
  /<set\b/i,
  /javascript:/i,
  /vbscript:/i,
  /data\s*:\s*text\/html/i,
  /on\w+\s*=/i, // onclick=, onload=, onerror=…
  /expression\s*\(/i, // CSS antiguo IE
  /url\s*\(\s*["']?\s*javascript:/i,
];

export function svgLooksLikeSvg(content: string): boolean {
  const trimmed = content.trimStart();
  return trimmed.startsWith('<?xml') || trimmed.toLowerCase().startsWith('<svg');
}

/** true = seguro de almacenar/servir; false = rechazar con 422. */
export function isSvgSafe(content: string): boolean {
  if (!svgLooksLikeSvg(content)) return true; // no es SVG: lo decide el sniff de magia.
  const lower = content.toLowerCase();
  // `url(#fragmento)` local está bien; `href` a recursos externos, no.
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(content)) return false;
  }
  // href/xlink:href solo a fragmentos locales (#id).
  const hrefRe = /(?:xlink:)?href\s*=\s*"([^"]*)"/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRe.exec(lower)) !== null) {
    const target = (match[1] ?? '').trim();
    if (!target.startsWith('#')) return false;
  }
  return true;
}
