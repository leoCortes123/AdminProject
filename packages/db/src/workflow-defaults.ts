/**
 * Defaults de workflow por producto (§5.4: estados configurables y transiciones controladas).
 * Lo usan el seed y la creación de producto (F1-T06) para que un producto nuevo
 * nazca con su espacio de trabajo listo.
 */

export interface WorkflowStateSeed {
  scope: 'task' | 'issue';
  key: string;
  label: string;
  color: string;
  position: number;
  isTerminal: boolean;
}

export interface WorkflowTransitionSeed {
  scope: 'task' | 'issue';
  fromKey: string | null; // null = estado inicial alcanzable directamente
  toKey: string;
  requiredPermission?: string;
  requiresConfirmation?: boolean;
}

export const DEFAULT_WORKFLOW_STATES: WorkflowStateSeed[] = [
  // tasks
  {
    scope: 'task',
    key: 'backlog',
    label: 'Backlog',
    color: '#64748b',
    position: 0,
    isTerminal: false,
  },
  {
    scope: 'task',
    key: 'todo',
    label: 'Pendiente',
    color: '#3b82f6',
    position: 1,
    isTerminal: false,
  },
  {
    scope: 'task',
    key: 'in_progress',
    label: 'En curso',
    color: '#f59e0b',
    position: 2,
    isTerminal: false,
  },
  {
    scope: 'task',
    key: 'in_review',
    label: 'En revisión',
    color: '#8b5cf6',
    position: 3,
    isTerminal: false,
  },
  { scope: 'task', key: 'done', label: 'Hecha', color: '#22c55e', position: 4, isTerminal: true },
  {
    scope: 'task',
    key: 'cancelled',
    label: 'Cancelada',
    color: '#ef4444',
    position: 5,
    isTerminal: true,
  },
  // issues
  {
    scope: 'issue',
    key: 'open',
    label: 'Abierta',
    color: '#ef4444',
    position: 0,
    isTerminal: false,
  },
  {
    scope: 'issue',
    key: 'in_progress',
    label: 'En curso',
    color: '#f59e0b',
    position: 1,
    isTerminal: false,
  },
  {
    scope: 'issue',
    key: 'resolved',
    label: 'Resuelta',
    color: '#22c55e',
    position: 2,
    isTerminal: true,
  },
  {
    scope: 'issue',
    key: 'closed',
    label: 'Cerrada',
    color: '#64748b',
    position: 3,
    isTerminal: true,
  },
];

export const DEFAULT_WORKFLOW_TRANSITIONS: WorkflowTransitionSeed[] = [
  // tasks
  { scope: 'task', fromKey: null, toKey: 'backlog' },
  { scope: 'task', fromKey: 'backlog', toKey: 'todo' },
  { scope: 'task', fromKey: 'todo', toKey: 'in_progress' },
  { scope: 'task', fromKey: 'todo', toKey: 'backlog' },
  { scope: 'task', fromKey: 'in_progress', toKey: 'in_review' },
  { scope: 'task', fromKey: 'in_progress', toKey: 'todo' },
  { scope: 'task', fromKey: 'in_review', toKey: 'done', requiredPermission: 'tasks:write' },
  { scope: 'task', fromKey: 'in_review', toKey: 'in_progress' },
  { scope: 'task', fromKey: 'done', toKey: 'in_progress', requiresConfirmation: true },
  { scope: 'task', fromKey: 'backlog', toKey: 'cancelled' },
  { scope: 'task', fromKey: 'todo', toKey: 'cancelled' },
  { scope: 'task', fromKey: 'in_progress', toKey: 'cancelled', requiresConfirmation: true },
  // issues
  { scope: 'issue', fromKey: null, toKey: 'open' },
  { scope: 'issue', fromKey: 'open', toKey: 'in_progress' },
  { scope: 'issue', fromKey: 'in_progress', toKey: 'resolved', requiresConfirmation: false },
  { scope: 'issue', fromKey: 'resolved', toKey: 'closed' },
  { scope: 'issue', fromKey: 'closed', toKey: 'open', requiresConfirmation: true },
  { scope: 'issue', fromKey: 'open', toKey: 'closed', requiresConfirmation: true },
];
