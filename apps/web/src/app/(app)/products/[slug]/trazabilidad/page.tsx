import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError, requireMe } from '@/lib/api';
import type { DocumentItem, ProductDetail, ProductNode } from '@/lib/types';
import { TrazabilidadView } from '@/components/trazabilidad-view';

export const metadata: Metadata = { title: 'Trazabilidad' };

export default async function TrazabilidadPage({ params }: { params: Promise<{ slug: string }> }) {
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
  const [nodes, documents] = await Promise.all([
    apiFetch<ProductNode[]>(`/api/v1/products/${slug}/nodes`).catch(() => [] as ProductNode[]),
    apiFetch<DocumentItem[]>(`/api/v1/products/${slug}/documents`).catch(
      () => [] as DocumentItem[],
    ),
  ]);

  return (
    <TrazabilidadView slug={slug} productName={product.name} nodes={nodes} documents={documents} />
  );
}
