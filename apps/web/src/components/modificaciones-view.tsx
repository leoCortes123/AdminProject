'use client';

import { useMemo, useState } from 'react';
import { EmptyState } from '@devcycle/ui';
import type { ChangeItem, ProductNode, TaskItem, IssueItem } from '@/lib/types';

const KIND_LABEL: Record<string, string> = {
  functional: 'Funcional',
  technical: 'Técnico',
};
const STATUS_LABEL: Record<string, string> = {
  proposed: 'Propuesto',
  executed: 'Ejecutado',
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

export function ModificacionesView({
  slug,
  productName,
  initialChanges,
  nodes,
  tasks,
  issues,
  canWrite,
  canExecute,
}: {
  slug: string;
  productName: string;
  initialChanges: ChangeItem[];
  nodes: ProductNode[];
  tasks: TaskItem[];
  issues: IssueItem[];
  canWrite: boolean;
  canExecute: boolean;
}) {
  const base = `/api/v1/products/${slug}/changes`;
  const [changes, setChanges] = useState<ChangeItem[]>(initialChanges);
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(initialChanges[0]?.id ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState('functional');
  const [newDescription, setNewDescription] = useState('');
  const [newNodeCode, setNewNodeCode] = useState('');
  const [newGitSha, setNewGitSha] = useState('');
  const [linkTaskId, setLinkTaskId] = useState('');
  const [linkIssueId, setLinkIssueId] = useState('');

  const selected = changes.find((c) => c.id === selectedId) ?? null;

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
    return changes.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [c.title, c.code ?? '', c.description, ...c.nodeCodes].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [changes, statusFilter, query]);

  const refresh = async () => {
    const data = await api<ChangeItem[]>(base);
    setChanges(data);
  };

  const handleCreate = () =>
    run(async () => {
      const created = await api<ChangeItem>(base, {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle,
          kind: newKind,
          description: newDescription,
          nodeCodes: newNodeCode ? [newNodeCode] : [],
          ...(newGitSha ? { gitSha: newGitSha } : {}),
        }),
      });
      setChanges((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setCreateOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewNodeCode('');
      setNewGitSha('');
    }, 'Modificación propuesta.');

  const handleExecute = () =>
    run(async () => {
      if (!selected) return;
      const updated = await api<ChangeItem & { resolvedIncidents: string[] }>(
        `${base}/${selected.id}/execute`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      setChanges((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      await refresh();
    }, 'Modificación ejecutada — incidencias vinculadas resueltas.');

  return (
    <>
      <div className="view-head">
        <div>
          <h1>Modificaciones</h1>
          <p className="sub">
            Registro de cambios sobre el producto · distingue cambios propuestos de cambios
            ejecutados · <strong>{productName}</strong>
          </p>
        </div>
        <div className="spacer" />
        {canWrite && (
          <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            + Registrar modificación
          </button>
        )}
      </div>

      <div className="filter-bar" role="group" aria-label="Filtrar modificaciones">
        <span className="lbl">Estado</span>
        <button
          type="button"
          className={`btn btn-sm ${statusFilter === '' ? 'btn-primary' : ''}`}
          onClick={() => setStatusFilter('')}
        >
          Todas
        </button>
        <button
          type="button"
          className={`btn btn-sm ${statusFilter === 'proposed' ? 'btn-primary' : ''}`}
          onClick={() => setStatusFilter('proposed')}
        >
          Propuestas
        </button>
        <button
          type="button"
          className={`btn btn-sm ${statusFilter === 'executed' ? 'btn-primary' : ''}`}
          onClick={() => setStatusFilter('executed')}
        >
          Ejecutadas
        </button>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar modificación o nodo…"
          aria-label="Buscar modificación"
          style={{ marginLeft: 8 }}
        />
        <span className="lbl" style={{ marginLeft: 'auto' }}>
          {filtered.length} de {changes.length} modificaciones
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

      <div className="panel">
        <div className="panel-pad tbl-wrap">
          <table className="tbl" aria-label="Tabla de modificaciones">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Fecha</th>
                <th scope="col">Tipo</th>
                <th scope="col">Descripción</th>
                <th scope="col">Estado</th>
                <th scope="col">Elementos afectados</th>
                <th scope="col">Tareas</th>
                <th scope="col">Incid.</th>
                <th scope="col">Git</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className={c.id === selectedId ? 'selected' : ''}
                  onClick={() => setSelectedId(c.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="mono">{c.code ?? c.id.slice(0, 8)}</td>
                  <td className="mono">{new Date(c.createdAt).toISOString().slice(0, 10)}</td>
                  <td>{KIND_LABEL[c.kind] ?? c.kind}</td>
                  <td style={{ maxWidth: 280, whiteSpace: 'normal' }}>{c.title}</td>
                  <td>
                    <span className={`pill ${c.status === 'executed' ? 'pill-ok' : 'pill-info'}`}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="mono">{c.nodeCodes.join(' · ') || '—'}</td>
                  <td className="mono">{c.taskIds.length || '—'}</td>
                  <td className="mono">{c.resolvedIssueIds.length || '—'}</td>
                  <td className="mono">{c.gitSha ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: 12 }}>
              <EmptyState
                title="Ninguna modificación coincide"
                description={
                  changes.length === 0
                    ? 'Aún no hay modificaciones. Registra la primera para ver la historia del producto.'
                    : 'Prueba con otro estado o término de búsqueda.'
                }
              />
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div
          className="panel panel-pad"
          style={{ marginTop: 12 }}
          aria-label="Detalle de la modificación"
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 13 }}>
              {selected.code ?? 'MOD'} · {selected.title}
            </strong>
            <span className={`pill ${selected.status === 'executed' ? 'pill-ok' : 'pill-info'}`}>
              {STATUS_LABEL[selected.status] ?? selected.status}
            </span>
            <span className="mono" style={{ marginLeft: 'auto' }}>
              {KIND_LABEL[selected.kind] ?? selected.kind}
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.6 }}>
            {selected.description || 'Sin descripción.'}
          </p>
          <dl className="kv" style={{ marginTop: 12 }}>
            <dt>Nodos afectados</dt>
            <dd className="mono">{selected.nodeCodes.join(', ') || '—'}</dd>
            <dt>Tareas</dt>
            <dd>{selected.taskIds.length} vinculada(s)</dd>
            <dt>Incidencias resueltas</dt>
            <dd>{selected.resolvedIssueIds.length} resuelta(s)</dd>
            <dt>Git</dt>
            <dd className="mono">
              {selected.gitSha
                ? `${selected.gitSha}${selected.gitBranch ? ` · ${selected.gitBranch}` : ''}`
                : '—'}
            </dd>
            {selected.executedAt && (
              <>
                <dt>Ejecutada</dt>
                <dd>{new Date(selected.executedAt).toLocaleString('es-ES')}</dd>
              </>
            )}
          </dl>
          {canExecute && selected.status === 'proposed' && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => void handleExecute()}
            >
              Ejecutar modificación
            </button>
          )}
          {canWrite && (
            <div
              style={{
                marginTop: 12,
                display: 'flex',
                gap: 6,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <select
                value={linkTaskId}
                onChange={(e) => setLinkTaskId(e.target.value)}
                aria-label="Tarea a vincular"
                style={{
                  border: '1px solid var(--line-strong)',
                  borderRadius: 7,
                  padding: '4px 6px',
                  fontSize: 11,
                }}
              >
                <option value="">Vincular tarea…</option>
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
                onClick={() =>
                  void run(async () => {
                    await api(`${base}/${selected.id}/tasks`, {
                      method: 'POST',
                      body: JSON.stringify({ taskId: linkTaskId }),
                    });
                    setLinkTaskId('');
                    await refresh();
                  }, 'Tarea vinculada.')
                }
              >
                Vincular tarea
              </button>
              <select
                value={linkIssueId}
                onChange={(e) => setLinkIssueId(e.target.value)}
                aria-label="Incidencia a vincular como resuelta"
                style={{
                  border: '1px solid var(--line-strong)',
                  borderRadius: 7,
                  padding: '4px 6px',
                  fontSize: 11,
                }}
              >
                <option value="">Vincular incidencia (resuelve)…</option>
                {issues.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.code ?? i.id.slice(0, 8)} · {i.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-sm"
                disabled={!linkIssueId}
                onClick={() =>
                  void run(async () => {
                    await api(`${base}/${selected.id}/resolves`, {
                      method: 'POST',
                      body: JSON.stringify({ issueId: linkIssueId }),
                    });
                    setLinkIssueId('');
                    await refresh();
                  }, 'Incidencia vinculada (se cerrará al ejecutar).')
                }
              >
                Vincular incidencia
              </button>
            </div>
          )}
        </div>
      )}

      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Registrar modificación"
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
              <strong>Registrar modificación</strong>
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
                Tipo
                <select
                  value={newKind}
                  onChange={(e) => setNewKind(e.target.value)}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                  }}
                >
                  <option value="functional">Funcional</option>
                  <option value="technical">Técnico</option>
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
                Git SHA (opcional)
                <input
                  type="text"
                  value={newGitSha}
                  onChange={(e) => setNewGitSha(e.target.value)}
                  placeholder="a3f9c21"
                  style={{
                    width: '100%',
                    marginTop: 4,
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                    fontFamily: 'var(--mono)',
                  }}
                />
              </label>
              <label style={{ fontSize: 11, fontWeight: 600 }}>
                Descripción
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
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
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!newTitle.trim()}
                  onClick={() => void handleCreate()}
                >
                  Proponer
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
