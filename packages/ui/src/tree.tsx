import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export interface TreeItem {
  id: string;
  label: string;
  /** Código legible (p. ej. `PANT-02`); pinta `.node-id` mono. */
  code?: string;
  /** Color del tipo de nodo (punto/swatch). */
  typeColor?: string;
  children?: TreeItem[];
}

export interface TreeProps {
  items: TreeItem[];
  selectedId?: string | null;
  onSelect?: (item: TreeItem) => void;
  ariaLabel?: string;
  emptyMessage?: string;
  /** Modo controlado (ids expandidos). Si no se pasa, el componente gestiona su estado. */
  expandedIds?: Set<string>;
  onExpandedIdsChange?: (ids: Set<string>) => void;
}

interface FlatRow {
  item: TreeItem;
  depth: number;
  hasChildren: boolean;
  parentId: string | null;
}

/** Recolecta todos los ids con hijos (para expandir todo desde el consumidor). */
export function collectExpandableIds(items: TreeItem[]): Set<string> {
  const ids = new Set<string>();
  const walk = (nodes: TreeItem[]) => {
    for (const node of nodes) {
      if (node.children?.length) {
        ids.add(node.id);
        walk(node.children);
      }
    }
  };
  walk(items);
  return ids;
}

function flatten(items: TreeItem[], expanded: Set<string>): FlatRow[] {
  const rows: FlatRow[] = [];
  const walk = (nodes: TreeItem[], depth: number, parentId: string | null) => {
    for (const item of nodes) {
      const children = item.children ?? [];
      const hasChildren = children.length > 0;
      rows.push({ item, depth, hasChildren, parentId });
      if (hasChildren && expanded.has(item.id)) {
        walk(children, depth + 1, item.id);
      }
    }
  };
  walk(items, 0, null);
  return rows;
}

/**
 * Árbol funcional (`role="tree"`). Filas planas con sangría por nivel,
 * navegación por teclado completa (↑↓ Home/End ←→ expandir/colapsar) y
 * selección controlada por el consumidor (`selectedId`/`onSelect`).
 */
export function Tree({
  items,
  selectedId,
  onSelect,
  ariaLabel,
  emptyMessage = 'Sin elementos',
  expandedIds,
  onExpandedIdsChange,
}: TreeProps) {
  const [internalExpanded, setInternalExpanded] = useState<Set<string>>(() => collectExpandableIds(items));
  const expanded = expandedIds ?? internalExpanded;
  const setExpanded = useCallback(
    (updater: (current: Set<string>) => Set<string>) => {
      const next = updater(expanded);
      if (onExpandedIdsChange) {
        onExpandedIdsChange(next);
      } else {
        setInternalExpanded(next);
      }
    },
    [expanded, onExpandedIdsChange],
  );

  const rows = useMemo(() => flatten(items, expanded), [items, expanded]);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  const focusRow = useCallback((id: string | undefined) => {
    if (id) rowRefs.current.get(id)?.focus();
  }, []);

  const toggle = useCallback(
    (id: string) => {
      setExpanded((current) => {
        const next = new Set(current);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [setExpanded],
  );

  const onKeyDown = useCallback(
    (row: FlatRow, index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
      const { item, hasChildren, parentId } = row;
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          focusRow(rows[index + 1]?.item.id);
          break;
        case 'ArrowUp':
          event.preventDefault();
          focusRow(rows[index - 1]?.item.id);
          break;
        case 'Home':
          event.preventDefault();
          focusRow(rows[0]?.item.id);
          break;
        case 'End':
          event.preventDefault();
          focusRow(rows.at(-1)?.item.id);
          break;
        case 'ArrowRight':
          if (hasChildren && !expanded.has(item.id)) {
            event.preventDefault();
            toggle(item.id);
          } else if (hasChildren) {
            event.preventDefault();
            focusRow(rows[index + 1]?.item.id);
          }
          break;
        case 'ArrowLeft':
          if (hasChildren && expanded.has(item.id)) {
            event.preventDefault();
            toggle(item.id);
          } else {
            event.preventDefault();
            focusRow(parentId ?? undefined);
          }
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          onSelect?.(item);
          break;
        default:
          break;
      }
    },
    [expanded, focusRow, onSelect, rows, toggle],
  );

  if (items.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <div className="tree" role="tree" aria-label={ariaLabel}>
      {rows.map((row, index) => {
        const { item, depth, hasChildren } = row;
        const isExpanded = expanded.has(item.id);
        const isSelected = selectedId === item.id;
        return (
          <button
            key={item.id}
            ref={(element) => {
              if (element) rowRefs.current.set(item.id, element);
              else rowRefs.current.delete(item.id);
            }}
            type="button"
            role="treeitem"
            aria-level={depth + 1}
            aria-expanded={hasChildren ? isExpanded : undefined}
            aria-selected={isSelected}
            className={['tree-row', isSelected ? 'selected' : '', hasChildren ? '' : 'leaf']
              .filter(Boolean)
              .join(' ')}
            style={{ paddingLeft: `${8 + depth * 18}px` }}
            onClick={() => onSelect?.(item)}
            onKeyDown={onKeyDown(row, index)}
          >
            <span
              className={`caret${isExpanded ? ' open' : ''}`}
              aria-hidden="true"
              onClick={(event) => {
                if (hasChildren) {
                  event.stopPropagation();
                  toggle(item.id);
                }
              }}
            >
              ›
            </span>
            {item.typeColor && (
              <span
                aria-hidden="true"
                style={{ width: 8, height: 8, borderRadius: 2, background: item.typeColor, flex: '0 0 auto' }}
              />
            )}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
            {item.code && <span className="node-id">{item.code}</span>}
          </button>
        );
      })}
    </div>
  );
}
