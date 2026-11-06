import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError, requireMe } from '@/lib/api';
import type { ProductDetail, ProductMember, ProductNode } from '@/lib/types';
import { EmptyState, Pill } from '@devcycle/ui';
import { computeModuleProgress } from '@/lib/tree';
import { initials, productStatusLabel, productStatusTone } from '@/lib/format';

const ROLE_LABELS: Record<string, string> = {
  admin_global: 'Administrador global',
  admin_product: 'Administrador de producto',
  collaborator: 'Colaborador',
  viewer: 'Consulta',
};

export const metadata: Metadata = { title: 'Resumen' };

export default async function ResumenPage({ params }: { params: Promise<{ slug: string }> }) {
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

  const [nodes, members] = await Promise.all([
    apiFetch<ProductNode[]>(`/api/v1/products/${slug}/nodes`).catch(() => [] as ProductNode[]),
    apiFetch<ProductMember[]>(`/api/v1/products/${slug}/members`).catch(
      () => [] as ProductMember[],
    ),
  ]);

  const moduleProgress = computeModuleProgress(nodes);
  const doneNodes = nodes.filter((node) => node.status === 'done').length;
  const totalNodes = nodes.length;
  const pct = totalNodes === 0 ? 0 : Math.round((doneNodes / totalNodes) * 100);

  return (
    <>
      <div className="panel product-hero">
        <div className="product-logo" style={{ background: product.color ?? undefined }}>
          {product.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 19, letterSpacing: '-.4px' }}>{product.name}</h1>
            <Pill tone={productStatusTone(product.status)}>
              {productStatusLabel(product.status)}
            </Pill>
            {product.role && (
              <Pill tone="accent">Tu rol: {ROLE_LABELS[product.role] ?? product.role}</Pill>
            )}
          </div>
          {product.tagline && (
            <p className="sub" style={{ marginTop: 3 }}>
              {product.tagline}
            </p>
          )}
          {product.techStack.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {product.techStack.map((tech) => (
                <span key={tech} className="stack-chip">
                  {tech}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" disabled title="Disponible en una fase posterior">
            Configuración del producto
          </button>
        </div>
      </div>

      <div className="split-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="panel panel-pad">
            <div className="panel-title">Descripción y objetivos</div>
            {product.description ? (
              <p style={{ fontSize: '12.5px', lineHeight: 1.55, color: 'var(--ink)' }}>
                {product.description}
              </p>
            ) : (
              <EmptyState
                title="Sin descripción"
                description="Este producto aún no tiene una descripción ni objetivos registrados. Se gestionarán en la ficha del producto en fases posteriores."
              />
            )}
          </div>

          <div className="panel panel-pad">
            <div className="panel-title">Información tecnológica</div>
            <dl className="kv">
              <dt>Repositorio</dt>
              <dd className="mono">
                {product.repoUrl ? (
                  <a
                    href={product.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--accent-ink)' }}
                  >
                    {product.repoUrl}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
              <dt>Árbol funcional</dt>
              <dd>
                {totalNodes} nodos · {doneNodes} hechos ({pct}%)
              </dd>
            </dl>
          </div>

          <div className="panel panel-pad">
            <div className="panel-title">Avance por módulo</div>
            {moduleProgress.length === 0 ? (
              <EmptyState
                title="Aún no hay módulos"
                description="Crea nodos de tipo módulo en Arquitectura funcional para ver el avance aquí."
              />
            ) : (
              moduleProgress.map((module) => (
                <div key={module.id} className="module-row">
                  <div className="m-top">
                    <span className="m-name">
                      <span className="mono" style={{ color: 'var(--ink-3)', marginRight: 8 }}>
                        {module.code}
                      </span>
                      {module.name}
                    </span>
                    <div className="progress" style={{ flex: 1 }}>
                      <span style={{ width: `${module.pct}%` }} />
                    </div>
                    <span className="m-pct">{module.pct}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="panel panel-pad">
            <div className="panel-title">
              Integrantes <span className="count">{members.length}</span>
            </div>
            {members.length === 0 ? (
              <EmptyState
                title="Sin integrantes"
                description="Aún no hay miembros registrados en este producto."
              />
            ) : (
              members.map((member) => (
                <div key={member.userId} className="member-row">
                  <span
                    className="member-avatar"
                    style={{ background: 'var(--accent)' }}
                    aria-hidden="true"
                  >
                    {initials(member.name)}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 600, display: 'block' }}>{member.name}</span>
                    <span className="m-mail">{member.email}</span>
                  </span>
                  <Pill
                    tone={member.roleKey === 'admin_product' ? 'accent' : 'neutral'}
                    className=""
                  >
                    {ROLE_LABELS[member.roleKey] ?? member.roleKey}
                  </Pill>
                </div>
              ))
            )}
          </div>

          <div className="panel panel-pad">
            <div className="panel-title">Actividad reciente</div>
            <EmptyState
              title="Sin actividad visible"
              description="El feed de actividad humana e IA llegará con el módulo de trazabilidad (Fase 4). En Fase 1, las operaciones sobre nodos quedan registradas en activity_log por la API."
            />
          </div>
        </div>
      </div>
    </>
  );
}
