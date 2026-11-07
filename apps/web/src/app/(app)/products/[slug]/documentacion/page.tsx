import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError, requireMe } from '@/lib/api';
import type { DocumentItem, DocumentType, ProductDetail, ProductNode } from '@/lib/types';
import { DocsView } from '@/components/docs-view';

export const metadata: Metadata = { title: 'Documentación' };

export default async function DocumentacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ doc?: string }>;
}) {
  const [{ slug }, { doc }] = await Promise.all([params, searchParams]);
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
  const [docs, types, nodes] = await Promise.all([
    apiFetch<DocumentItem[]>(`/api/v1/products/${slug}/documents`).catch(
      () => [] as DocumentItem[],
    ),
    apiFetch<DocumentType[]>(`/api/v1/products/${slug}/documents/types`).catch(
      () => [] as DocumentType[],
    ),
    apiFetch<ProductNode[]>(`/api/v1/products/${slug}/nodes`).catch(() => [] as ProductNode[]),
  ]);

  const role = product.role ?? 'viewer';
  const canWrite = ['admin_global', 'admin_product', 'collaborator'].includes(role);
  const canPublish = ['admin_global', 'admin_product'].includes(role);

  return (
    <DocsView
      slug={slug}
      productName={product.name}
      initialDocs={docs}
      types={types}
      nodes={nodes}
      {...(doc ? { initialDocId: doc } : {})}
      canWrite={canWrite}
      canPublish={canPublish}
    />
  );
}
