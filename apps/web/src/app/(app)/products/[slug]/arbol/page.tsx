import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError, requireMe } from '@/lib/api';
import type { ProductDetail, ProductNode } from '@/lib/types';
import { ArbolView } from '@/components/tree-view';

export const metadata: Metadata = { title: 'Arquitectura funcional' };

export default async function ArbolPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ node?: string }>;
}) {
  const [{ slug }, { node }] = await Promise.all([params, searchParams]);
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
  const nodes = await apiFetch<ProductNode[]>(`/api/v1/products/${slug}/nodes`).catch(
    () => [] as ProductNode[],
  );

  const role = product.role ?? 'viewer';
  const canWrite = ['admin_global', 'admin_product', 'collaborator'].includes(role);

  return (
    <ArbolView
      productName={product.name}
      productSlug={slug}
      nodes={nodes}
      canWrite={canWrite}
      {...(node ? { initialNodeCode: node } : {})}
    />
  );
}
