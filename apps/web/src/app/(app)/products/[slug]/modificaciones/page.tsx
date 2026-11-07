import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError, requireMe } from '@/lib/api';
import type { ChangeItem, IssueItem, ProductDetail, ProductNode, TaskItem } from '@/lib/types';
import { ModificacionesView } from '@/components/modificaciones-view';

export const metadata: Metadata = { title: 'Modificaciones' };

export default async function ModificacionesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireMe();

  let product: ProductDetail;
  try {
    product = await apiFetch<ProductDetail>(`/api/v1/products/${slug}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      notFound();
    }
    throw error;
  }
  const [changes, nodes, tasks, issues] = await Promise.all([
    apiFetch<ChangeItem[]>(`/api/v1/products/${slug}/changes`).catch(() => [] as ChangeItem[]),
    apiFetch<ProductNode[]>(`/api/v1/products/${slug}/nodes`).catch(() => [] as ProductNode[]),
    apiFetch<TaskItem[]>(`/api/v1/products/${slug}/tasks`).catch(() => [] as TaskItem[]),
    apiFetch<IssueItem[]>(`/api/v1/products/${slug}/issues`).catch(() => [] as IssueItem[]),
  ]);

  const role = product.role ?? 'viewer';
  const canWrite = ['admin_global', 'admin_product', 'collaborator'].includes(role);
  const canExecute = ['admin_global', 'admin_product'].includes(role);

  return (
    <ModificacionesView
      slug={slug}
      productName={product.name}
      initialChanges={changes}
      nodes={nodes}
      tasks={tasks}
      issues={issues}
      canWrite={canWrite}
      canExecute={canExecute}
    />
  );
}
