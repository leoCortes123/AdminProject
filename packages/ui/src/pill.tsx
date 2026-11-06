import type { ReactNode } from 'react';

export type PillTone =
  | 'ok'
  | 'warn'
  | 'crit'
  | 'info'
  | 'neutral'
  | 'violet'
  | 'accent';

export interface PillProps {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
}

/** Badge semántico del design system (portar clases `.pill-*` de muckup/css). */
export function Pill({ tone = 'neutral', children, className }: PillProps) {
  const classes = ['pill', `pill-${tone}`, className].filter(Boolean).join(' ');
  return <span className={classes}>{children}</span>;
}
