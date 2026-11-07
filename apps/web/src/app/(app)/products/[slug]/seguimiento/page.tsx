import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError, requireMe } from '@/lib/api';
import type { ActivityPage, CoverageDto, OverviewDto, ProductDetail } from '@/lib/types';
import { SeguimientoView } from '@/components/seguimiento-view';

export const metadata: Metadata = { title: 'Seguimiento' };

export default async function SeguimientoPage({ params }: { params: Promise<{ slug: string }> }) {
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
  const [overview, coverage, activity] = await Promise.all([
    apiFetch<OverviewDto>(`/api/v1/products/${slug}/overview`).catch(() => null),
    apiFetch<CoverageDto>(`/api/v1/products/${slug}/coverage`).catch(() => null),
    apiFetch<ActivityPage>(`/api/v1/products/${slug}/activity?limit=50`).catch(
      () => ({ items: [], nextCursor: null }) as ActivityPage,
    ),
  ]);

  if (!overview || !coverage) {
    throw overview
      ? new Error('No se pudo cargar la cobertura')
      : new Error('No se pudo cargar el seguimiento');
  }

  return (
    <SeguimientoView
      slug={slug}
      productName={product.name}
      initialOverview={overview}
      initialCoverage={coverage}
      initialActivity={activity}
    />
  );
}
