import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError, requireMe } from '@/lib/api';
import type { AgentExecution, ProductDetail, ServiceAccount } from '@/lib/types';
import { IntegracionesView } from '@/components/integraciones-view';

export const metadata: Metadata = { title: 'Integraciones y agentes' };

export default async function IntegracionesPage({ params }: { params: Promise<{ slug: string }> }) {
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

  const [accounts, executions] = await Promise.all([
    apiFetch<ServiceAccount[]>(`/api/v1/products/${slug}/integration/service-accounts`).catch(
      () => [] as ServiceAccount[],
    ),
    apiFetch<AgentExecution[]>(`/api/v1/products/${slug}/integration/executions`).catch(
      () => [] as AgentExecution[],
    ),
  ]);

  return (
    <IntegracionesView
      slug={slug}
      productName={product.name}
      initialAccounts={accounts}
      initialExecutions={executions}
    />
  );
}
