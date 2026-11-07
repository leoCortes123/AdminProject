'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { EmptyState } from '@devcycle/ui';
import type { ActivityEntry, ActivityPage, CoverageDto, OverviewDto } from '@/lib/types';

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};
const SEVERITY_TONE: Record<string, string> = {
  critical: 'pill-crit',
  high: 'pill-warn',
  medium: 'pill-neutral',
  low: 'pill-neutral',
};
const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

async function api<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = res.statusText;
    try {
      const json = JSON.parse(text) as { detail?: string; title?: string };
      detail = json.detail ?? json.title ?? detail;
    } catch {
      detail = text || detail;
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  return (await res.json()) as T;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}

export function SeguimientoView({
  slug,
  productName,
  initialOverview,
  initialCoverage,
  initialActivity,
}: {
  slug: string;
  productName: string;
  initialOverview: OverviewDto;
  initialCoverage: CoverageDto;
  initialActivity: ActivityPage;
}) {
  const [overview] = useState(initialOverview);
  const [coverage] = useState(initialCoverage);
  const [activity, setActivity] = useState<ActivityEntry[]>(initialActivity.items);
  const [nextCursor, setNextCursor] = useState<string | null>(initialActivity.nextCursor);
  const [actorFilter, setActorFilter] = useState<string>('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadActivity = useCallback(
    async (cursor: string | null, append: boolean) => {
      const params = new URLSearchParams({ limit: '50' });
      if (cursor) params.set('cursor', cursor);
      if (actorFilter) params.set('actorType', actorFilter);
      try {
        const page = await api<ActivityPage>(
          `/api/v1/products/${slug}/activity?${params.toString()}`,
        );
        setActivity((prev) => (append ? [...prev, ...page.items] : page.items));
        setNextCursor(page.nextCursor);
        setError(null);
      } catch (err) {
        setError(errorMessage(err));
      }
    },
    [slug, actorFilter],
  );

  // Al cambiar el filtro de actor, recarga desde la primera página.
  useEffect(() => {
    setActivity([]);
    setNextCursor(null);
    void loadActivity(null, false);
  }, [loadActivity]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    await loadActivity(nextCursor, true);
    setLoadingMore(false);
  };

  const counts = overview.counts;
  const issuesBySeverity = counts.issuesBySeverity ?? {};

  return (
    <>
      <div className="view-head">
        <div>
          <h1>Seguimiento</h1>
          <p className="sub">
            Tablas, listas y vistas jerárquicas — sin dashboards saturados de tarjetas ·{' '}
            <strong>{productName}</strong>
          </p>
        </div>
        <div className="spacer" />
        <a className="btn btn-sm" href={`/api/v1/products/${slug}/export?kind=tasks`} download>
          Exportar tareas CSV
        </a>
        <a className="btn btn-sm" href={`/api/v1/products/${slug}/export?kind=issues`} download>
          Exportar incidencias CSV
        </a>
        <a className="btn btn-sm" href={`/api/v1/products/${slug}/export?kind=changes`} download>
          Exportar modificaciones CSV
        </a>
      </div>

      <div className="kpi-strip">
        <div className="kpi">
          <div className="k-label">Tareas abiertas</div>
          <div className="k-value">{counts.tasksOpen}</div>
          <div className="k-foot">de {counts.tasksTotal} en total</div>
        </div>
        <div className="kpi crit">
          <div className="k-label">Tareas bloqueadas</div>
          <div className="k-value">{counts.tasksBlocked}</div>
          <div className="k-foot">
            {overview.blockedTasks
              .slice(0, 2)
              .map((t) => t.code ?? t.title)
              .join(' · ') || 'Sin bloqueos'}
          </div>
        </div>
        <div className="kpi warn">
          <div className="k-label">Incidencias abiertas</div>
          <div className="k-value">{counts.issuesOpen}</div>
          <div className="k-foot">
            {issuesBySeverity.critical ? `${issuesBySeverity.critical} crítica(s) · ` : ''}
            {issuesBySeverity.high ? `${issuesBySeverity.high} alta(s) · ` : ''}
            {issuesBySeverity.medium ? `${issuesBySeverity.medium} media(s) · ` : ''}
            {issuesBySeverity.low ? `${issuesBySeverity.low} baja(s)` : ''}
            {counts.issuesOpen === 0 ? 'Sin incidencias abiertas' : ''}
          </div>
        </div>
        <div className="kpi ok">
          <div className="k-label">Avance del producto</div>
          <div className="k-value">{overview.avancePct}%</div>
          <div className="k-foot">
            {counts.tasksDone} de {counts.tasksTotal} tareas hechas (conteo simple)
          </div>
        </div>
      </div>

      {error && (
        <div className="org-banner" role="alert" style={{ display: 'flex', marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="split-2">
        <div className="panel panel-pad">
          <div className="panel-title">Avance por módulo</div>
          {overview.modules.length === 0 ? (
            <EmptyState
              title="Aún no hay módulos"
              description="Crea nodos de tipo módulo en Arquitectura funcional para ver el avance aquí."
            />
          ) : (
            overview.modules.map((mod) => (
              <div key={mod.id} className="module-row">
                <div className="m-top">
                  <span className="m-name">
                    <span className="mono" style={{ color: 'var(--ink-3)', marginRight: 8 }}>
                      {mod.code}
                    </span>
                    {mod.name}
                  </span>
                  <div className="progress" style={{ flex: 1 }}>
                    <span style={{ width: `${mod.pct}%` }} />
                  </div>
                  <span className="m-pct">{mod.pct}%</span>
                </div>
                <div className="sub-row">
                  <span>
                    {mod.tasksTotal > 0
                      ? `${mod.tasksDone}/${mod.tasksTotal} tareas`
                      : `${mod.nodesDone}/${mod.nodesTotal} nodos hechos`}
                  </span>
                </div>
              </div>
            ))
          )}

          <div className="panel-title" style={{ marginTop: 16 }}>
            Actividad reciente
          </div>
          <div className="filter-bar" role="group" aria-label="Filtrar actividad por actor">
            <span className="lbl">Actor</span>
            <button
              type="button"
              className={`btn btn-sm ${actorFilter === '' ? 'btn-primary' : ''}`}
              onClick={() => setActorFilter('')}
            >
              Todos
            </button>
            <button
              type="button"
              className={`btn btn-sm ${actorFilter === 'human' ? 'btn-primary' : ''}`}
              onClick={() => setActorFilter('human')}
            >
              Humanos
            </button>
            <button
              type="button"
              className={`btn btn-sm ${actorFilter === 'agent' ? 'btn-primary' : ''}`}
              onClick={() => setActorFilter('agent')}
            >
              Agentes IA
            </button>
          </div>
          {activity.length === 0 ? (
            <EmptyState
              title="Sin actividad visible"
              description="Las acciones humanas y de agentes aparecerán aquí cuando se cree contenido en el producto."
            />
          ) : (
            <ul className="timeline">
              {activity.map((entry) => (
                <li key={entry.id} className={entry.actorType === 'agent' ? 'ia' : ''}>
                  <span className="t-time">{relativeTime(entry.createdAt)}</span>
                  <span className="t-text">
                    <strong>{entry.actorType === 'agent' ? 'Agente IA' : 'Humano'}</strong> ·{' '}
                    {entry.summary}
                    <span className="mono" style={{ color: 'var(--ink-3)', marginLeft: 6 }}>
                      {entry.action}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {nextCursor && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => void handleLoadMore()}
              disabled={loadingMore}
              style={{ marginTop: 8 }}
            >
              {loadingMore ? 'Cargando…' : 'Cargar más'}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="panel panel-pad">
            <div className="panel-title">
              Incidencias abiertas <span className="count">{overview.openIssues.length}</span>
            </div>
            {overview.openIssues.length === 0 ? (
              <EmptyState
                title="Sin incidencias abiertas"
                description="Todas las incidencias del producto están resueltas o cerradas."
              />
            ) : (
              <ul className="ov-list">
                {overview.openIssues.map((issue) => (
                  <li key={issue.id}>
                    <span
                      className={`pill ${SEVERITY_TONE[issue.severity] ?? 'pill-neutral'}`}
                      style={{ minWidth: 64, justifyContent: 'center' }}
                    >
                      {SEVERITY_LABEL[issue.severity] ?? issue.severity}
                    </span>
                    <span style={{ flex: 1 }}>{issue.title}</span>
                    <Link
                      className="mono"
                      href={`/products/${slug}/incidencias`}
                      style={{ color: 'var(--accent-ink)' }}
                    >
                      {issue.code ?? issue.id.slice(0, 8)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel panel-pad">
            <div className="panel-title">
              Elementos sin documentación{' '}
              <span className="count">{coverage.withoutDocsList.length}</span>
            </div>
            <p className="sub" style={{ fontSize: 11, margin: '0 0 8px' }}>
              Cobertura documental {coverage.pctDocs}% ({coverage.withDocs}/{coverage.totalNodes}{' '}
              nodos)
            </p>
            {coverage.withoutDocsList.length === 0 ? (
              <EmptyState
                title="Cobertura completa"
                description="Todos los nodos tienen documentación vinculada."
              />
            ) : (
              <ul className="ov-list">
                {coverage.withoutDocsList.slice(0, 10).map((node) => (
                  <li key={node.id}>
                    <span className="mono">{node.code}</span>
                    <span style={{ flex: 1 }}>{node.name}</span>
                    <Link
                      className="btn btn-sm btn-ghost"
                      href={`/products/${slug}/arbol?node=${encodeURIComponent(node.code)}`}
                      style={{ marginLeft: 'auto' }}
                    >
                      Ver en árbol
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel panel-pad">
            <div className="panel-title">
              Funcionalidades sin pruebas{' '}
              <span className="count">{coverage.withoutTestsList.length}</span>
            </div>
            <p className="sub" style={{ fontSize: 11, margin: '0 0 8px' }}>
              Cobertura de pruebas {coverage.pctTests}% ({coverage.withTests}/{coverage.totalNodes}{' '}
              nodos)
            </p>
            {coverage.withoutTestsList.length === 0 ? (
              <EmptyState
                title="Cobertura completa"
                description="Todos los nodos tienen casos de prueba vinculados."
              />
            ) : (
              <ul className="ov-list">
                {coverage.withoutTestsList.slice(0, 10).map((node) => (
                  <li key={node.id}>
                    <span className="mono">{node.code}</span>
                    <span style={{ flex: 1 }}>{node.name}</span>
                    <Link
                      className="mono"
                      href={`/products/${slug}/trazabilidad`}
                      style={{ color: 'var(--accent-ink)' }}
                    >
                      Trazabilidad
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel panel-pad">
            <div className="panel-title">
              Tareas bloqueadas <span className="count">{overview.blockedTasks.length}</span>
            </div>
            {overview.blockedTasks.length === 0 ? (
              <EmptyState
                title="Sin bloqueos"
                description="Ninguna tarea depende de otra tarea en este momento."
              />
            ) : (
              <ul className="ov-list">
                {overview.blockedTasks.map((task) => (
                  <li key={task.id}>
                    <span className="mono">{task.code}</span>
                    <span style={{ flex: 1 }}>{task.title}</span>
                    <span className="mono" style={{ color: 'var(--ink-3)' }}>
                      {PRIORITY_LABEL[task.priority] ?? task.priority}
                    </span>
                    <Link
                      className="mono"
                      href={`/products/${slug}/tareas`}
                      style={{ color: 'var(--accent-ink)' }}
                    >
                      Ver
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel panel-pad">
            <div className="panel-title">
              Modificaciones recientes{' '}
              <span className="count">{overview.recentChanges.length}</span>
            </div>
            {overview.recentChanges.length === 0 ? (
              <EmptyState
                title="Sin modificaciones"
                description="Las modificaciones propuestas y ejecutadas aparecerán aquí."
              />
            ) : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Título</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recentChanges.map((change) => (
                      <tr key={change.id}>
                        <td className="mono">{change.code ?? change.id.slice(0, 8)}</td>
                        <td>
                          <Link
                            href={`/products/${slug}/modificaciones`}
                            style={{ color: 'inherit' }}
                          >
                            {change.title}
                          </Link>
                        </td>
                        <td>{change.status === 'executed' ? 'Ejecutada' : 'Propuesta'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
