import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Estado vacío del design system (`.empty-state` del mockup). */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state" role="note">
      <div style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{title}</div>
      {description && <div style={{ marginTop: 4 }}>{description}</div>}
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  );
}
