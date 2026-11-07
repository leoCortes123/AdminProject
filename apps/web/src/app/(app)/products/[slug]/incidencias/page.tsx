import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError, requireMe } from '@/lib/api';
import type { IssueItem, ProductDetail, ProductNode, TaskItem, WorkflowState } from '@/lib/types';
import { IssuesView } from '@/components/issues-view';

export const metadata: Metadata = { title: 'Incidencias' };

export default async function IncidenciasPage({ params }: { params: Promise<{ slug: string }> }) {
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
  const [issues, states, nodes, tasks] = await Promise.all([
    apiFetch<IssueItem[]>(`/api/v1/products/${slug}/issues`).catch(() => [] as IssueItem[]),
    apiFetch<WorkflowState[]>(`/api/v1/products/${slug}/issues/states`).catch(
      () => [] as WorkflowState[],
    ),
    apiFetch<ProductNode[]>(`/api/v1/products/${slug}/nodes`).catch(() => [] as ProductNode[]),
    apiFetch<TaskItem[]>(`/api/v1/products/${slug}/tasks`).catch(() => [] as TaskItem[]),
  ]);

  const role = product.role ?? 'viewer';
  const canWrite = ['admin_global', 'admin_product', 'collaborator'].includes(role);

  return (
    <IssuesView
      slug={slug}
      productName={product.name}
      initialIssues={issues}
      states={states}
      nodes={nodes}
      tasks={tasks}
      canWrite={canWrite}
    />
  );
}
