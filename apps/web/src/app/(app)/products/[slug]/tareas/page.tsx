import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError, requireMe } from '@/lib/api';
import type { ProductDetail, ProductNode, TaskItem, WorkflowState } from '@/lib/types';
import { TasksView } from '@/components/tasks-view';

export const metadata: Metadata = { title: 'Tareas' };

export default async function TareasPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ slug }, { view }] = await Promise.all([params, searchParams]);
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
  const [tasks, states, nodes] = await Promise.all([
    apiFetch<TaskItem[]>(`/api/v1/products/${slug}/tasks`).catch(() => [] as TaskItem[]),
    apiFetch<WorkflowState[]>(`/api/v1/products/${slug}/tasks/states`).catch(
      () => [] as WorkflowState[],
    ),
    apiFetch<ProductNode[]>(`/api/v1/products/${slug}/nodes`).catch(() => [] as ProductNode[]),
  ]);

  const role = product.role ?? 'viewer';
  const canWrite = ['admin_global', 'admin_product', 'collaborator'].includes(role);

  const initialView = view === 'kanban' || view === 'tree' ? view : 'table';

  return (
    <TasksView
      slug={slug}
      productName={product.name}
      initialTasks={tasks}
      states={states}
      nodes={nodes}
      initialView={initialView}
      canWrite={canWrite}
    />
  );
}
