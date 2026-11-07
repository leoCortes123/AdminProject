import { diffLines } from 'diff';
import type { Change } from 'diff';

export interface DiffPart {
  value: string;
  added: boolean;
  removed: boolean;
}

/** Diff por líneas entre dos cuerpos Markdown (cliente, F2-T03). */
export function diffMarkdown(oldBody: string, newBody: string): DiffPart[] {
  const changes: Change[] = diffLines(oldBody, newBody);
  return changes.map((change) => ({
    value: change.value,
    added: Boolean(change.added),
    removed: Boolean(change.removed),
  }));
}

export function diffStats(oldBody: string, newBody: string): { added: number; removed: number } {
  const parts = diffMarkdown(oldBody, newBody);
  let added = 0;
  let removed = 0;
  for (const part of parts) {
    const lines = part.value.split('\n').filter(Boolean).length;
    if (part.added) added += lines;
    if (part.removed) removed += lines;
  }
  return { added, removed };
}
