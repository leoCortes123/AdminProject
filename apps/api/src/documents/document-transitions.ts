import type { DocumentStatus } from '@devcycle/shared';

/**
 * Máquina de estados documental (F2-T02) — función pura, unit-testeable.
 *
 *   draft ──► in_review ──► published ──► archived
 *     │          │  ▲                         ▲
 *     └──────────┴──┴────► archived            │
 *     ▲                                        │
 *     └────────────────── archived ────────────┘
 * (archived → draft reabre; published → draft NO: se edita creando versión)
 *
 * Publicar exige además el permiso `docs:publish` (lo verifica el guard/servicio).
 */
const ALLOWED: Readonly<Record<DocumentStatus, readonly DocumentStatus[]>> = {
  draft: ['in_review', 'archived'],
  in_review: ['published', 'draft', 'archived'],
  published: ['archived'],
  archived: ['draft'],
};

export function allowedTransitions(from: DocumentStatus): readonly DocumentStatus[] {
  return ALLOWED[from];
}

export function canTransition(from: DocumentStatus, to: DocumentStatus): boolean {
  if (from === to) return true;
  return ALLOWED[from].includes(to);
}

export function isPublishTransition(from: DocumentStatus, to: DocumentStatus): boolean {
  return to === 'published' && from !== to;
}
