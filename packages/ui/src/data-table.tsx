import type { ReactNode } from 'react';

export interface DataTableColumn<T> {
  /** Clave única de la columna (también usada como key de React). */
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedRowKey?: string | null;
  emptyMessage?: string;
  ariaLabel?: string;
}

/**
 * Tabla densa del design system (`.tbl` del mockup): `.tbl-wrap` + `<table class="tbl">`.
 * Filas clicables con `onRowClick`; `selectedRowKey` pinta la fila activa.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedRowKey,
  emptyMessage = 'Sin datos todavía',
  ariaLabel,
}: DataTableProps<T>) {
  return (
    <div className="tbl-wrap">
      <table className="tbl" aria-label={ariaLabel}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.className}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ color: 'var(--ink-3)', textAlign: 'center' }}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const key = rowKey(row);
              const selected = selectedRowKey === key;
              const classes = onRowClick ? 'clickable' : undefined;
              return (
                <tr
                  key={key}
                  className={[classes, selected ? 'selected' : ''].filter(Boolean).join(' ') || undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  aria-selected={onRowClick ? selected : undefined}
                >
                  {columns.map((column) => (
                    <td key={column.key} className={column.className}>
                      {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? '')}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
