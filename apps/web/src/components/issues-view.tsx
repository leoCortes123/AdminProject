'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@devcycle/ui';
import type { CommentItem, IssueItem, ProductNode, TaskItem, WorkflowState } from '@/lib/types';

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

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'same-origin',
  });
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

export function IssuesView({
  slug,
  productName,
  initialIssues,
  states,
  nodes,
  tasks,
  canWrite,
}: {
  slug: string;
  productName: string;
  initialIssues: IssueItem[];
  states: WorkflowState[];
  nodes: ProductNode[];
  tasks: TaskItem[];
  canWrite: boolean;
}) {
  const base = `/api/v1/products/${slug}/issues`;
  const [issues, setIssues] = useState<IssueItem[]>(initialIssues);
  const [severityFilter, setSeverityFilter] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(initialIssues[0]?.id ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSeverity, setNewSeverity] = useState('medium');
  const [newNodeCode, setNewNodeCode] = useState('');
  const [newExpected, setNewExpected] = useState('');
  const [newObserved, setNewObserved] = useState('');
  const [newSteps, setNewSteps] = useState('');
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState('');
  const [linkTaskId, setLinkTaskId] = useState('');

  const selected = issues.find((i) => i.id === selectedId) ?? null;

  const refresh = useCallback(async () => {
    try {
      const data = await api<IssueItem[]>(base);
      setIssues(data);
      return data;
    } catch (err) {
      setError(errorMessage(err));
      return null;
    }
  }, [base]);

  const refreshComments = useCallback(
    async (parentId: string) => {
      try {
        const data = await api<CommentItem[]>(
          `/api/v1/products/${slug}/comments/issue/${parentId}`,
        );
        setComments(data);
      } catch {
        setComments([]);
      }
    },
    [slug],
  );

  useEffect(() => {
    if (selected) void refreshComments(selected.id);
  }, [selected?.id, refreshComments]);

  const run = async (fn: () => Promise<void>, okMessage: string) => {
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(okMessage);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return issues.filter((i) => {
      if (severityFilter && i.severity !== severityFilter) return false;
      if (!q) return true;
      const hay = [i.title, i.code ?? '', i.description, i.observedBehavior, ...i.nodeCodes]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [issues, severityFilter, query]);

  const handleCreate = () =>
    run(async () => {
      const created = await api<IssueItem>(base, {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle,
          severity: newSeverity,
          expectedBehavior: newExpected,
          observedBehavior: newObserved,
          reproductionSteps: newSteps
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          nodeCodes: newNodeCode ? [newNodeCode] : [],
        }),
      });
      setIssues((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setCreateOpen(false);
      setNewTitle('');
      setNewExpected('');
      setNewObserved('');
      setNewSteps('');
    }, 'Incidencia reportada.');

  const handleTransition = (issueId: string, toStateKey: string) =>
    run(async () => {
      const updated = await api<IssueItem>(`${base}/${issueId}/status`, {
        method: 'POST',
        body: JSON.stringify({ toStateKey }),
      });
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    }, `Incidencia movida a ${toStateKey}.`);

  const handleLinkTask = () =>
    run(async () => {
      if (!selected || !linkTaskId) return;
      await api(`${base}/${selected.id}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ taskId: linkTaskId }),
      });
      setLinkTaskId('');
      await refresh();
    }, 'Tarea correctiva vinculada.');

  return (
    <>
      <div className="view-head">
        <div>
          <h1>Incidencias</h1>
          <p className="sub">
            Errores y problemas funcionales, vinculados a los elementos afectados y a sus tareas
            correctivas · <strong>{productName}</strong>
          </p>
        </div>
        <div className="spacer" />
        {canWrite && (
          <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            + Reportar incidencia
          </button>
        )}
      </div>

      <div className="filter-bar" role="group" aria-label="Filtrar incidencias">
        <span className="lbl">Severidad</span>
        <button
          type="button"
          className={`btn btn-sm ${severityFilter === '' ? 'btn-primary' : ''}`}
          onClick={() => setSeverityFilter('')}
        >
          Todas
        </button>
        {Object.entries(SEVERITY_LABEL).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`btn btn-sm ${severityFilter === k ? 'btn-primary' : ''}`}
            onClick={() => setSeverityFilter(k)}
          >
            {label}
          </button>
        ))}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar incidencia o nodo…"
          aria-label="Buscar incidencia"
          style={{ marginLeft: 8 }}
        />
        <span className="lbl" style={{ marginLeft: 'auto' }}>
          {filtered.length} de {issues.length} incidencias
        </span>
      </div>

      {notice && (
        <div className="org-banner" role="status" style={{ display: 'flex', marginBottom: 12 }}>
          {notice}
        </div>
      )}
      {error && (
        <div className="org-banner" role="alert" style={{ display: 'flex', marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="split-list-detail">
        <div className="panel panel-pad" style={{ maxHeight: 640, overflow: 'auto' }}>
          <div className="panel-title">
            Bandeja de incidencias <span className="count">{filtered.length}</span>
          </div>
          <div>
            {filtered.map((inc) => (
              <button
                key={inc.id}
                type="button"
                className={`inc-item ${inc.id === selectedId ? 'selected' : ''}`}
                onClick={() => setSelectedId(inc.id)}
                aria-current={inc.id === selectedId}
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
              >
                <span className={`pill ${SEVERITY_TONE[inc.severity] ?? 'pill-neutral'}`}>
                  {SEVERITY_LABEL[inc.severity] ?? inc.severity}
                </span>
                <span className="mono" style={{ marginLeft: 6 }}>
                  {inc.code ?? inc.id.slice(0, 8)} · {inc.stateLabel}
                </span>
                <h4>{inc.title}</h4>
                <small>
                  {inc.nodeCodes.join(', ') || 'sin nodo'} ·{' '}
                  {new Date(inc.updatedAt).toLocaleDateString('es-ES')}
                </small>
              </button>
            ))}
            {filtered.length === 0 && (
              <EmptyState
                title="Ninguna incidencia coincide"
                description={
                  issues.length === 0
                    ? 'Aún no hay incidencias. Reporta la primera desde aquí o desde la ficha del nodo.'
                    : 'Prueba con otra severidad o término de búsqueda.'
                }
              />
            )}
          </div>
        </div>

        <div className="panel panel-pad" aria-label="Detalle de la incidencia">
          {selected ? (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className={`pill ${SEVERITY_TONE[selected.severity] ?? 'pill-neutral'}`}>
                  {SEVERITY_LABEL[selected.severity] ?? selected.severity}
                </span>
                <strong style={{ fontSize: 13 }}>
                  {selected.code ?? ''} {selected.title}
                </strong>
                <span className="pill pill-accent" style={{ marginLeft: 'auto' }}>
                  {selected.stateLabel}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.6 }}>
                {selected.description || 'Sin descripción.'}
              </p>
              <dl className="kv" style={{ marginTop: 12 }}>
                <dt>Esperado</dt>
                <dd>{selected.expectedBehavior || '—'}</dd>
                <dt>Observado</dt>
                <dd>{selected.observedBehavior || '—'}</dd>
                <dt>Nodos</dt>
                <dd className="mono">{selected.nodeCodes.join(', ') || 'sin nodo'}</dd>
                <dt>Tareas correctivas</dt>
                <dd>{selected.linkedTaskIds.length} vinculada(s)</dd>
              </dl>
              {selected.reproductionSteps.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="panel-title">Pasos de reproducción</div>
                  <ol className="steps-list">
                    {selected.reproductionSteps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                {states.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={`btn btn-sm ${s.key === selected.stateKey ? 'btn-primary' : ''}`}
                    disabled={!canWrite || s.key === selected.stateKey}
                    onClick={() => void handleTransition(selected.id, s.key)}
                  >
                    {s.label}
                  </button>
                ))}
                {canWrite && selected.stateKey !== 'resolved' && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() =>
                      void run(async () => {
                        const updated = await api<IssueItem>(`${base}/${selected.id}/resolve`, {
                          method: 'POST',
                          body: JSON.stringify({}),
                        });
                        setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
                      }, 'Incidencia resuelta.')
                    }
                  >
                    Resolver
                  </button>
                )}
              </div>

              {canWrite && (
                <div style={{ marginTop: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select
                    value={linkTaskId}
                    onChange={(e) => setLinkTaskId(e.target.value)}
                    aria-label="Tarea correctiva a vincular"
                    style={{
                      border: '1px solid var(--line-strong)',
                      borderRadius: 7,
                      padding: '4px 6px',
                      fontSize: 11,
                    }}
                  >
                    <option value="">Vincular tarea correctiva…</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code ?? t.id.slice(0, 8)} · {t.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={!linkTaskId}
                    onClick={() => void handleLinkTask()}
                  >
                    Vincular
                  </button>
                </div>
              )}

              <div style={{ marginTop: 14 }}>
                <div className="panel-title">
                  Comentarios <span className="count">{comments.length}</span>
                </div>
                {comments.length === 0 ? (
                  <EmptyState
                    title="Sin comentarios"
                    description="Añade el primer comentario (las menciones @usuario se registran en la actividad)."
                  />
                ) : (
                  <ul className="timeline">
                    {comments.map((c) => (
                      <li key={c.id}>
                        <div className="t-time">
                          {new Date(c.createdAt).toLocaleString('es-ES')}
                        </div>
                        <div className="t-text">{c.body}</div>
                      </li>
                    ))}
                  </ul>
                )}
                {canWrite && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Añadir comentario (p. ej. @usuario: revisado)…"
                      aria-label="Nuevo comentario"
                      style={{
                        flex: 1,
                        border: '1px solid var(--line-strong)',
                        borderRadius: 7,
                        padding: '6px 8px',
                        fontSize: 12,
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={!newComment.trim()}
                      onClick={() =>
                        void run(async () => {
                          await api(`/api/v1/products/${slug}/comments`, {
                            method: 'POST',
                            body: JSON.stringify({
                              parentId: selected.id,
                              parentKind: 'issue',
                              body: newComment,
                            }),
                          });
                          setNewComment('');
                          void refreshComments(selected.id);
                        }, 'Comentario añadido.')
                      }
                    >
                      Comentar
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <EmptyState
              title="Selecciona una incidencia"
              description="Elige cualquier incidencia a la izquierda para ver su detalle y comentarios."
            />
          )}
        </div>
      </div>

      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Reportar incidencia"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(14,20,36,.45)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 50,
          }}
        >
          <div
            className="panel"
            style={{ width: 'min(560px, 90vw)', maxHeight: '80vh', overflow: 'auto' }}
          >
            <div
              className="panel-pad"
              style={{
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <strong>Reportar incidencia</strong>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                style={{ marginLeft: 'auto' }}
                onClick={() => setCreateOpen(false)}
                aria-label="Cerrar"
              >
                Cerrar
              </button>
            </div>
            <div
              className="panel-pad"
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <label style={{ fontSize: 11, fontWeight: 600 }}>
                Título
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                  }}
                />
              </label>
              <label style={{ fontSize: 11, fontWeight: 600 }}>
                Severidad
                <select
                  value={newSeverity}
                  onChange={(e) => setNewSeverity(e.target.value)}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                  }}
                >
                  {Object.entries(SEVERITY_LABEL).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 11, fontWeight: 600 }}>
                Nodo afectado (opcional)
                <select
                  value={newNodeCode}
                  onChange={(e) => setNewNodeCode(e.target.value)}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                  }}
                >
                  <option value="">Sin nodo</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.code}>
                      {n.code} · {n.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 11, fontWeight: 600 }}>
                Comportamiento esperado
                <textarea
                  value={newExpected}
                  onChange={(e) => setNewExpected(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                    fontSize: 12,
                  }}
                />
              </label>
              <label style={{ fontSize: 11, fontWeight: 600 }}>
                Comportamiento observado
                <textarea
                  value={newObserved}
                  onChange={(e) => setNewObserved(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                    fontSize: 12,
                  }}
                />
              </label>
              <label style={{ fontSize: 11, fontWeight: 600 }}>
                Pasos de reproducción (uno por línea)
                <textarea
                  value={newSteps}
                  onChange={(e) => setNewSteps(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                    fontSize: 12,
                    fontFamily: 'var(--mono)',
                  }}
                />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!newTitle.trim()}
                  onClick={() => void handleCreate()}
                >
                  Reportar
                </button>
                <button type="button" className="btn" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
