'use client';

import { useRouter } from 'next/navigation';
import { DataTable, type DataTableColumn } from '@devcycle/ui';
import { Pill } from '@devcycle/ui';
import { productStatusLabel, productStatusTone } from '@/lib/format';
import type { ProductListItem } from '@/lib/types';

export interface ProductRow extends ProductListItem {
  moduleCount: number | null;
  nodeCount: number | null;
  memberCount: number | null;
}

const columns: DataTableColumn<ProductRow>[] = [
  {
    key: 'name',
    header: 'Producto',
    render: (row) => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          aria-hidden="true"
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: row.color ?? 'var(--accent)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 12,
            fontWeight: 800,
            flex: '0 0 auto',
          }}
        >
          {row.name.charAt(0).toUpperCase()}
        </span>
        <span>
          <strong style={{ display: 'block' }}>{row.name}</strong>
          {row.tagline && <small style={{ color: 'var(--ink-2)' }}>{row.tagline}</small>}
        </span>
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Estado',
    render: (row) => <Pill tone={productStatusTone(row.status)}>{productStatusLabel(row.status)}</Pill>,
  },
  { key: 'moduleCount', header: 'Módulos', render: (row) => (row.moduleCount ?? '—') },
  { key: 'nodeCount', header: 'Nodos', render: (row) => (row.nodeCount ?? '—') },
  { key: 'memberCount', header: 'Integrantes', render: (row) => (row.memberCount ?? '—') },
];

export function ProductsTable({ rows }: { rows: ProductRow[] }) {
  const router = useRouter();
  return (
    <DataTable<ProductRow>
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      onRowClick={(row) => router.push(`/products/${row.slug}/resumen`)}
      ariaLabel="Tabla de productos"
      emptyMessage="Aún no hay productos visibles"
    />
  );
}
