import type { Metadata } from 'next';
import { apiFetch, requireMe } from '@/lib/api';
import type { ProductListItem, ProductMember, ProductNode } from '@/lib/types';
import { ProductsTable, type ProductRow } from '@/components/products-table';
import { NewProductButton } from '@/components/new-product-button';
import { productStatusLabel } from '@/lib/format';
import type { ProductStatus } from '@/lib/types';

export const metadata: Metadata = { title: 'Productos' };

export default async function ProductsPage() {
  const [me, productsResponse] = await Promise.all([
    requireMe(),
    apiFetch<{ items: ProductListItem[] }>('/api/v1/products'),
  ]);
  const products = productsResponse.items;
  const isAdminGlobal = me.globalRoles.includes('admin_global');

  // Contadores reales por producto (árbol + integrantes). Fallos → null (se pinta "—").
  const rows: ProductRow[] = await Promise.all(
    products.map(async (product) => {
      const [nodes, members] = await Promise.all([
        apiFetch<ProductNode[]>(`/api/v1/products/${product.slug}/nodes`).catch(() => null),
        apiFetch<ProductMember[]>(`/api/v1/products/${product.slug}/members`).catch(() => null),
      ]);
      return {
        ...product,
        moduleCount: nodes ? nodes.filter((n) => n.nodeType.key === 'modulo').length : null,
        nodeCount: nodes ? nodes.length : null,
        memberCount: members ? members.length : null,
      };
    }),
  );

  const byStatus = products.reduce<Record<string, number>>((acc, product) => {
    acc[product.status] = (acc[product.status] ?? 0) + 1;
    return acc;
  }, {});
  const statusSummary = Object.entries(byStatus)
    .map(
      ([status, count]) => `${count} ${productStatusLabel(status as ProductStatus).toLowerCase()}`,
    )
    .join(' · ');

  return (
    <>
      <div className="view-head">
        <div>
          <h1>Productos</h1>
          <p className="sub">
            Organización general · {products.length} producto{products.length === 1 ? '' : 's'}{' '}
            registrado{products.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="spacer" />
        <NewProductButton canManage={isAdminGlobal} />
      </div>

      <div className="kpi-strip">
        <div className="kpi">
          <div className="k-label">Productos</div>
          <div className="k-value">{products.length}</div>
          <div className="k-foot">{statusSummary || 'sin productos'}</div>
        </div>
        <div className="kpi ok">
          <div className="k-label">Activos</div>
          <div className="k-value">{byStatus['active'] ?? 0}</div>
          <div className="k-foot">en producción</div>
        </div>
        <div className="kpi warn">
          <div className="k-label">En desarrollo</div>
          <div className="k-value">{byStatus['in_development'] ?? 0}</div>
          <div className="k-foot">pre-release</div>
        </div>
        <div className="kpi">
          <div className="k-label">Nodos del árbol</div>
          <div className="k-value">{rows.reduce((acc, row) => acc + (row.nodeCount ?? 0), 0)}</div>
          <div className="k-foot">arquitectura funcional (Fase 1)</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-pad">
          <ProductsTable rows={rows} />
        </div>
      </div>
      <p style={{ color: 'var(--ink-3)', fontSize: '10.5px', marginTop: 8 }}>
        Haz clic en una fila para entrar al espacio de trabajo del producto. La organización no
        mezcla información entre productos: solo agrega métricas.
      </p>
    </>
  );
}
