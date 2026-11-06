import { apiFetch, requireMe } from '@/lib/api';
import type { MeResponse, ProductListItem } from '@/lib/types';
import { AppShell } from '@/components/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [me, productsResponse] = await Promise.all([
    requireMe(),
    apiFetch<{ items: ProductListItem[] }>('/api/v1/products'),
  ]);
  return (
    <AppShell products={productsResponse.items} me={me as MeResponse}>
      {children}
    </AppShell>
  );
}
