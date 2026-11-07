'use client';

import { useCallback, useEffect, useMemo, useState, startTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CommandPalette, type CommandItem } from '@devcycle/ui';
import { authClient } from '@/lib/auth-client';
import { initials } from '@/lib/format';
import type { MeResponse, ProductListItem, ProductNode, DocumentItem } from '@/lib/types';

interface AppShellProps {
  children: React.ReactNode;
  products: ProductListItem[];
  me: MeResponse;
}

const NAV_ICON = {
  productos: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  resumen: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  arbol: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  docs: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  tareas: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  incidencias: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  modificaciones: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
    </svg>
  ),
  trazabilidad: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="6" cy="6" r="3" />
      <circle cx="18" cy="18" r="3" />
      <circle cx="18" cy="6" r="3" />
    </svg>
  ),
  seguimiento: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  agentes: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
    </svg>
  ),
  config: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  sitemap: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="21" y1="6" x2="3" y2="6" />
      <line x1="17" y1="12" x2="3" y2="12" />
      <line x1="13" y1="18" x2="3" y2="18" />
    </svg>
  ),
} as const;

const ROLE_LABELS: Record<string, string> = {
  admin_global: 'Administrador global',
  admin_product: 'Administrador de producto',
  collaborator: 'Colaborador',
  viewer: 'Consulta',
};

/** Extrae el slug de producto del pathname (/products/:slug/...) — null en org. */
function productSlugFromPath(pathname: string): string | null {
  const match = /^\/products\/([^/]+)/.exec(pathname);
  const slug = match?.[1];
  return slug && slug !== 'new' ? slug : null;
}

export function AppShell({ children, products, me }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [nodesForPalette, setNodesForPalette] = useState<ProductNode[] | null>(null);
  const [docsForPalette, setDocsForPalette] = useState<DocumentItem[] | null>(null);
  // Selector de contexto: valor elegido hasta que la navegación se confirme.
  const [pendingContext, setPendingContext] = useState<string | null>(null);

  const slug = productSlugFromPath(pathname);
  const currentProduct = slug ? (products.find((product) => product.slug === slug) ?? null) : null;
  const orgMode = currentProduct === null;

  const roleKey = me.globalRoles.includes('admin_global')
    ? 'admin_global'
    : (currentProduct?.role ?? me.memberships.find((m) => m.slug === slug)?.roleKey ?? 'viewer');

  // Selector de contexto → navegación diferida: si se cambia a mitad de carga,
  // el valor queda pendiente y el push ocurre tras el commit (startTransition).
  useEffect(() => {
    if (pendingContext === null) return;
    const url = pendingContext === 'org' ? '/products' : `/products/${pendingContext}/resumen`;
    startTransition(() => {
      router.push(url);
      setPendingContext(null);
    });
  }, [pendingContext, router]);

  // Ctrl/Cmd + K abre la paleta.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Carga perezosa del árbol del producto actual para la paleta (Ctrl+K).
  useEffect(() => {
    setNodesForPalette(null);
    setDocsForPalette(null);
  }, [slug]);
  useEffect(() => {
    if (!paletteOpen || !slug || nodesForPalette !== null) return;
    let cancelled = false;
    fetch(`/api/v1/products/${slug}/nodes`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ProductNode[]) => {
        if (!cancelled) setNodesForPalette(data);
      })
      .catch(() => {
        if (!cancelled) setNodesForPalette([]);
      });
    fetch(`/api/v1/products/${slug}/documents`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: DocumentItem[]) => {
        if (!cancelled) setDocsForPalette(data);
      })
      .catch(() => {
        if (!cancelled) setDocsForPalette([]);
      });
    return () => {
      cancelled = true;
    };
  }, [paletteOpen, slug, nodesForPalette]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const paletteItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      {
        id: 'nav-productos',
        label: 'Productos (organización)',
        hint: 'Navegación',
        keywords: 'org productos',
        onSelect: () => router.push('/products'),
      },
    ];
    for (const product of products) {
      items.push({
        id: `nav-${product.slug}-resumen`,
        label: `${product.name} · Resumen`,
        hint: 'Producto',
        keywords: `producto ${product.slug} ${product.name}`,
        onSelect: () => router.push(`/products/${product.slug}/resumen`),
      });
      items.push({
        id: `nav-${product.slug}-arbol`,
        label: `${product.name} · Arquitectura funcional`,
        hint: 'Producto',
        keywords: `producto ${product.slug} ${product.name} árbol arbol arquitectura nodos`,
        onSelect: () => router.push(`/products/${product.slug}/arbol`),
      });
      items.push({
        id: `nav-${product.slug}-documentacion`,
        label: `${product.name} · Documentación`,
        hint: 'Producto',
        keywords: `producto ${product.slug} ${product.name} documentación docs documento`,
        onSelect: () => router.push(`/products/${product.slug}/documentacion`),
      });
    }
    if (currentProduct && nodesForPalette) {
      for (const node of nodesForPalette) {
        items.push({
          id: `node-${node.id}`,
          label: `${node.code} · ${node.name}`,
          hint: `${currentProduct.name} → ${node.nodeType.label}`,
          keywords: `${node.code} ${node.name} ${node.path} ${node.nodeType.key}`,
          onSelect: () => router.push(`/products/${currentProduct.slug}/arbol?node=${node.code}`),
        });
      }
    }
    if (currentProduct && docsForPalette) {
      for (const doc of docsForPalette) {
        items.push({
          id: `doc-${doc.id}`,
          label: `${doc.code ?? 'Documento'} · ${doc.title}`,
          hint: `${currentProduct.name} → ${doc.docTypeLabel} · v${doc.version}`,
          keywords: `${doc.code ?? ''} ${doc.title} ${doc.docTypeLabel} ${doc.nodeCodes.join(', ')}`,
          onSelect: () =>
            router.push(`/products/${currentProduct.slug}/documentacion?doc=${doc.id}`),
        });
      }
    }
    return items;
  }, [products, currentProduct, nodesForPalette, docsForPalette, router]);

  const viewLabel = useMemo(() => {
    if (pathname === '/products') return 'Productos';
    if (/\/resumen$/.test(pathname)) return 'Resumen';
    if (/\/arbol$/.test(pathname)) return 'Arquitectura funcional';
    if (/\/documentacion$/.test(pathname)) return 'Documentación';
    return 'Vista';
  }, [pathname]);

  const navItem = (
    href: string | null,
    icon: React.ReactNode,
    label: string,
    badge?: string | number,
  ) => {
    if (href === null) {
      return (
        <span
          key={label}
          className="nav-item disabled"
          title="Disponible en una fase posterior"
          aria-disabled="true"
        >
          {icon}
          {label}
          <span className="soon">Pronto</span>
        </span>
      );
    }
    // '/products' es exacto (es la vista org); el resto, por prefijo.
    const active =
      href === '/products'
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={label}
        href={href}
        className={active ? 'nav-item active' : 'nav-item'}
        aria-current={active ? 'page' : undefined}
      >
        {icon}
        {label}
        {badge !== undefined && <span className="badge">{badge}</span>}
      </Link>
    );
  };

  return (
    <div className="app" data-context={orgMode ? 'org' : 'product'}>
      {/* ============ SIDEBAR ============ */}
      <aside className="sidebar" aria-label="Navegación principal">
        <div className="brand">
          <div className="brand-mark">DC</div>
          <div className="brand-name">
            DevCycle
            <small>Ciclo de vida del software</small>
          </div>
        </div>

        <div className="context-switch">
          <label htmlFor="productSwitcher">Contexto de trabajo</label>
          <select
            id="productSwitcher"
            className="context-select"
            aria-label="Cambiar producto o vista organización"
            value={pendingContext ?? (orgMode ? 'org' : (slug ?? 'org'))}
            onChange={(event) => setPendingContext(event.target.value)}
          >
            <option value="org">🌐 Organización general (todos los productos)</option>
            {products.map((product) => (
              <option key={product.slug} value={product.slug}>
                📦 {product.name}
              </option>
            ))}
          </select>
          {orgMode && (
            <p className="context-org-note">
              Cada producto tiene su propio espacio de trabajo aislado. La organización solo permite
              consulta transversal.
            </p>
          )}
        </div>

        <nav className="side-nav" aria-label="Secciones">
          <div className="nav-group">Organización</div>
          {navItem('/products', NAV_ICON.productos, 'Productos', products.length)}

          {!orgMode && (
            <>
              <div className="nav-group">
                <span className="live-dot" />
                Producto · <span>{currentProduct?.name}</span>
              </div>
              {navItem(`/products/${slug}/resumen`, NAV_ICON.resumen, 'Resumen')}
              {navItem(`/products/${slug}/arbol`, NAV_ICON.arbol, 'Arquitectura funcional')}
              {navItem(`/products/${slug}/documentacion`, NAV_ICON.docs, 'Documentación')}
              {navItem(null, NAV_ICON.tareas, 'Tareas')}
              {navItem(null, NAV_ICON.incidencias, 'Incidencias')}
              {navItem(null, NAV_ICON.modificaciones, 'Modificaciones')}
              {navItem(null, NAV_ICON.trazabilidad, 'Trazabilidad')}
              {navItem(null, NAV_ICON.seguimiento, 'Seguimiento')}
              {navItem(null, NAV_ICON.agentes, 'Agentes IA')}
            </>
          )}

          <div className="nav-group">Sistema</div>
          {navItem(null, NAV_ICON.config, 'Configuración')}
          {navItem(null, NAV_ICON.sitemap, 'Mapa del sistema')}
        </nav>

        <div className="sidebar-foot">
          <button
            type="button"
            className="nav-item"
            style={{ width: '100%', color: '#c4cce3' }}
            onClick={async () => {
              await authClient.signOut();
              router.push('/login');
              router.refresh();
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Cerrar sesión
          </button>
          <div style={{ marginTop: 8 }}>
            <strong>DevCycle v0.2 · Fase 2</strong>
            <br />
            {me.user.name} · {ROLE_LABELS[roleKey] ?? roleKey}
          </div>
        </div>
      </aside>

      {/* ============ MAIN ============ */}
      <div className="main">
        <header className="topbar">
          <nav className="breadcrumb" aria-label="Migas de pan">
            Acme &amp; Co
            <span className="sep">›</span>
            <span>{orgMode ? 'Organización general' : currentProduct?.name}</span>
            <span className="sep">›</span>
            <b>{viewLabel}</b>
          </nav>
          <div className="topbar-right">
            <button
              className="global-search"
              onClick={() => setPaletteOpen(true)}
              aria-label="Abrir buscador global (Ctrl K)"
              aria-keyshortcuts="Control+K"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Buscar nodo, tarea, doc…
              <kbd>Ctrl K</kbd>
            </button>
            <button
              className="icon-btn"
              aria-label="Notificaciones"
              onClick={() => showToast('Sin notificaciones nuevas')}
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>
            <div className="avatar" title={`${me.user.name} · ${ROLE_LABELS[roleKey] ?? roleKey}`}>
              {initials(me.user.name)}
            </div>
          </div>
        </header>

        <main className="screen">
          {orgMode && (
            <div className="org-banner" role="status" style={{ display: 'flex' }}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Vista <strong>organización general</strong>: solo consulta transversal. Selecciona un
              producto en el selector superior para entrar a su espacio de trabajo.
            </div>
          )}
          {children}
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={paletteItems}
        placeholder="Buscar producto, nodo o vista…"
        ariaLabel="Buscador global"
      />

      {toast && (
        <div className="toast-wrap">
          <div className="toast" role="status">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
