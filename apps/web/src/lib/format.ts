import type { NodeStatus, ProductStatus } from './types';
import type { PillTone } from '@devcycle/ui';

const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  active: 'Activo',
  in_development: 'En desarrollo',
  maintenance: 'Mantenimiento',
  archived: 'Archivado',
};
const PRODUCT_STATUS_TONE: Record<ProductStatus, PillTone> = {
  active: 'ok',
  in_development: 'warn',
  maintenance: 'neutral',
  archived: 'crit',
};
export const productStatusLabel = (s: ProductStatus) => PRODUCT_STATUS_LABEL[s];
export const productStatusTone = (s: ProductStatus): PillTone => PRODUCT_STATUS_TONE[s];

const NODE_STATUS_LABEL: Record<NodeStatus, string> = {
  planned: 'Planificado',
  in_progress: 'En curso',
  done: 'Hecho',
  deprecated: 'Deprecado',
  disabled: 'Desactivado',
};
const NODE_STATUS_TONE: Record<NodeStatus, PillTone> = {
  planned: 'neutral',
  in_progress: 'warn',
  done: 'ok',
  deprecated: 'violet',
  disabled: 'crit',
};
export const nodeStatusLabel = (s: NodeStatus) => NODE_STATUS_LABEL[s];
export const nodeStatusTone = (s: NodeStatus): PillTone => NODE_STATUS_TONE[s];

/** "hace 5 min" / "hace 2 h" / "hace 3 d" / fecha corta. */
export function timeAgo(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} d`;
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}
