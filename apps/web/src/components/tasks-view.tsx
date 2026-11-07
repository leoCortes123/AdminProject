'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@devcycle/ui';
import type { ProductNode, TaskItem, WorkflowState } from '@/lib/types';

const TYPE_LABEL: Record<string, string> = {
  development: 'Desarrollo',
  analysis: 'Análisis',
  documentation: 'Documentación',
  maintenance: 'Mantenimiento',
};

const PRIORITY_LABEL: Record<string, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

const PRIORITY_CLASS: Record<string, string> = {
  critical: 'prio-critica',
  high: 'prio-alta',
  medium: 'prio-media',
  low: 'prio-baja',
};

type ViewMode = 'tree' | 'table' | 'kanban';

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

export function TasksView({
  slug,
  productName,
  initialTasks,
  states,
  nodes,
  initialView,
  canWrite,
}: {
  slug: string;
  productName: string;
  initialTasks: TaskItem[];
  states: WorkflowState[];
  nodes: ProductNode[];
  initialView?: ViewMode;
  canWrite: boolean;
}) {
  const base = `/api/v1/products/${slug}/tasks`;
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [view, setView] = useState<ViewMode>(initialView ?? 'table');
  const [typeFilter, setTypeFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [nodeFilter, setNodeFilter] = useState('');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialTasks[0]?.id ?? null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('development');
  const [newPriority, setNewPriority] = useState('medium');
  const [newNodeCode, setNewNodeCode] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const dragOverCol = useRef<string | null>(null);

  // URL-driven: sincroniza ?view= en la URL (shallow).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') !== view) {
      params.set('view', view);
      window.history.replaceState(null, '', `?${params.toString()}`);
    }
  }, [view]);

  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  // (refresh inline in handlers via setTasks after mutations)

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
    return tasks.filter((t) => {
      if (typeFilter && t.type !== typeFilter) return false;
      if (stateFilter && t.stateKey !== stateFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (nodeFilter && !t.nodeCodes.includes(nodeFilter)) return false;
      if (!q) return true;
      const hay = [t.title, t.code ?? '', t.description, ...t.nodeCodes].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [tasks, typeFilter, stateFilter, priorityFilter, nodeFilter, query]);

  const groupedByState = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    for (const s of states) map.set(s.key, []);
    for (const t of filtered) {
      const list = map.get(t.stateKey) ?? [];
      list.push(t);
      map.set(t.stateKey, list);
    }
    return map;
  }, [filtered, states]);

  const groupedByNode = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    for (const t of filtered) {
      const keys = t.nodeCodes.length > 0 ? t.nodeCodes : ['(sin nodo)'];
      for (const code of keys) {
        const list = map.get(code) ?? [];
        list.push(t);
        map.set(code, list);
      }
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const handleCreate = () =>
    run(async () => {
      const created = await api<TaskItem>(base, {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle,
          type: newType,
          priority: newPriority,
          description: newDescription,
          nodeCodes: newNodeCode ? [newNodeCode] : [],
        }),
      });
      setTasks((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setCreateOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewNodeCode('');
    }, 'Tarea creada.');

  const handleTransition = (taskId: string, toStateKey: string) =>
    run(async () => {
      const updated = await api<TaskItem>(`${base}/${taskId}/status`, {
        method: 'POST',
        body: JSON.stringify({ toStateKey }),
      });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    }, `Tarea movida a ${toStateKey}.`);

  const handleDrop = (taskId: string, toStateKey: string) => {
    void handleTransition(taskId, toStateKey);
    setDragId(null);
  };

  // Detecta si un drop es válido según la API: el error 409 ya se muestra como notice.
  // No validamos en cliente para respetar "arrastrar respeta transiciones del servidor".

  return (
    <>
      <div className="view-head">
        <div>
          <h1>Tareas</h1>
          <p className="sub">
            Vista global sincronizada con el árbol funcional — misma información, tres
            representaciones · <strong>{productName}</strong>
          </p>
        </div>
        <div className="spacer" />
        <div className="view-toggle" role="tablist" aria-label="Cambiar representación">
          {(['tree', 'table', 'kanban'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={view === mode}
              className={view === mode ? 'active' : ''}
              onClick={() => setView(mode)}
            >
              {mode === 'tree' ? 'Árbol' : mode === 'table' ? 'Tabla' : 'Kanban'}
            </button>
          ))}
        </div>
        {canWrite && (
          <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            + Nueva tarea
          </button>
        )}
      </div>

      <div className="filter-bar" aria-label="Filtros de tareas">
        <span className="lbl">Tipo</span>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filtrar por tipo"
        >
          <option value="">Todos</option>
          {Object.entries(TYPE_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <span className="lbl">Estado</span>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos</option>
          {states.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <span className="lbl">Prioridad</span>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          aria-label="Filtrar por prioridad"
        >
          <option value="">Todas</option>
          {Object.entries(PRIORITY_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <span className="lbl">Nodo</span>
        <select
          value={nodeFilter}
          onChange={(e) => setNodeFilter(e.target.value)}
          aria-label="Filtrar por nodo"
        >
          <option value="">Todos</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.code}>
              {n.code}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar tarea o nodo (p. ej. PANT-02)…"
          aria-label="Buscar tarea"
        />
        <span className="lbl" style={{ marginLeft: 'auto' }}>
          {filtered.length} de {tasks.length} tareas
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

      {view === 'table' && (
        <div className="panel">
          <div className="panel-pad tbl-wrap">
            <table className="tbl" aria-label="Tabla de tareas">
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Título</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Nodo funcional</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Prioridad</th>
                  <th scope="col">Límite</th>
                  <th scope="col">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    className={t.id === selectedId ? 'selected' : ''}
                    onClick={() => setSelectedId(t.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="mono">{t.code ?? t.id.slice(0, 8)}</td>
                    <td>
                      <strong style={{ fontSize: 12 }}>{t.title}</strong>
                      {t.blockedBy.length > 0 && (
                        <span className="pill pill-warn" style={{ marginLeft: 6 }}>
                          Bloqueada
                        </span>
                      )}
                    </td>
                    <td>{TYPE_LABEL[t.type] ?? t.type}</td>
                    <td>
                      <span className="mono">{t.nodeCodes.join(', ') || '—'}</span>
                    </td>
                    <td>
                      <span className="pill pill-info">{t.stateLabel}</span>
                    </td>
                    <td>
                      <span className="type-dot">
                        <i
                          className={`prio-bar ${PRIORITY_CLASS[t.priority] ?? 'prio-media'}`}
                          aria-hidden="true"
                        />
                        {PRIORITY_LABEL[t.priority] ?? t.priority}
                      </span>
                    </td>
                    <td>{t.dueDate ?? '—'}</td>
                    <td>
                      {canWrite && (
                        <select
                          aria-label={`Mover ${t.code ?? t.title} a estado`}
                          value={t.stateKey}
                          onChange={(e) => {
                            e.stopPropagation();
                            void handleTransition(t.id, e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            fontSize: 11,
                            border: '1px solid var(--line-strong)',
                            borderRadius: 6,
                            padding: '4px 6px',
                          }}
                        >
                          {states.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div style={{ padding: 12 }}>
                <EmptyState
                  title="Ninguna tarea coincide con el filtro"
                  description={
                    tasks.length === 0
                      ? 'Aún no hay tareas. Crea la primera tarea o vincula una desde la ficha del nodo.'
                      : 'Prueba con otros filtros o un término distinto (p. ej. PANT-02).'
                  }
                />
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'kanban' && (
        <div className="kanban" role="region" aria-label="Tablero Kanban de tareas">
          {states.map((state) => {
            const colTasks = groupedByState.get(state.key) ?? [];
            return (
              <section
                key={state.key}
                className="kanban-col"
                data-state={state.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  dragOverCol.current = state.key;
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) handleDrop(dragId, state.key);
                }}
              >
                <header style={{ borderTop: `3px solid ${state.color ?? 'var(--line-strong)'}` }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: state.color ?? '#94a3b8',
                      display: 'inline-block',
                    }}
                  />
                  {state.label}
                  <span className="cnt" aria-label={`${colTasks.length} tareas en ${state.label}`}>
                    {colTasks.length}
                  </span>
                </header>
                <div className="kanban-body">
                  {colTasks.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="task-card"
                      draggable={canWrite}
                      data-task={t.id}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', t.id);
                        setDragId(t.id);
                      }}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => setSelectedId(t.id)}
                      aria-label={`${t.code ?? ''} ${t.title} — estado ${t.stateLabel}`}
                      style={{
                        borderLeftColor: t.stateColor ?? 'var(--line-strong)',
                        background: t.id === selectedId ? 'var(--accent-soft)' : '#fff',
                      }}
                    >
                      <span className="tc-id">
                        <span>{t.code ?? t.id.slice(0, 8)}</span>
                        <span
                          className={`prio-bar ${PRIORITY_CLASS[t.priority] ?? 'prio-media'}`}
                          aria-hidden="true"
                        />
                      </span>
                      <h4>{t.title}</h4>
                      <span className="tc-foot">
                        <span>{t.nodeCodes.join(', ') || 'sin nodo'}</span>
                        <span>{t.estimateMinutes ? `${t.estimateMinutes} min` : ''}</span>
                      </span>
                    </button>
                  ))}
                  {colTasks.length === 0 && (
                    <p
                      style={{
                        fontSize: 10.5,
                        color: 'var(--ink-3)',
                        padding: 8,
                        textAlign: 'center',
                      }}
                    >
                      Sin tareas — arrastra aquí
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {view === 'tree' && (
        <div className="panel panel-pad" aria-label="Tareas agrupadas por nodo funcional">
          {groupedByNode.length === 0 ? (
            <EmptyState
              title="Sin tareas para mostrar"
              description="Ajusta los filtros o crea una tarea vinculada a un nodo."
            />
          ) : (
            groupedByNode.map(([nodeCode, items]) => (
              <div key={nodeCode} style={{ marginBottom: 14 }}>
                <div className="panel-title">
                  <span className="mono">{nodeCode}</span>
                  <span className="count">{items.length}</span>
                </div>
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th scope="col">ID</th>
                        <th scope="col">Título</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Prioridad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((t) => (
                        <tr
                          key={t.id}
                          onClick={() => setSelectedId(t.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="mono">{t.code ?? t.id.slice(0, 8)}</td>
                          <td>{t.title}</td>
                          <td>
                            <span className="pill pill-info">{t.stateLabel}</span>
                          </td>
                          <td>{PRIORITY_LABEL[t.priority] ?? t.priority}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {selected && (
        <div className="panel panel-pad" style={{ marginTop: 12 }} aria-label="Detalle de la tarea">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 13 }}>
              {selected.code ?? 'Tarea'} · {selected.title}
            </strong>
            <span className="pill pill-info">{selected.stateLabel}</span>
            <span className="mono" style={{ marginLeft: 'auto' }}>
              {selected.nodeCodes.join(', ') || 'sin nodo'}
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.6 }}>
            {selected.description || 'Sin descripción.'}
          </p>
          {selected.acceptanceCriteria.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="panel-title">Criterios de aceptación</div>
              <ul style={{ paddingLeft: 18, fontSize: 12, lineHeight: 1.7 }}>
                {selected.acceptanceCriteria.map((c, i) => (
                  <li key={i}>
                    {c.done ? '✓' : '○'} {c.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 10,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <span className="lbl">Mover a</span>
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
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-3)' }}>
            {selected.blockedBy.length > 0 && (
              <span>Bloqueada por {selected.blockedBy.length} dependencia(s). </span>
            )}
            {selected.blocks.length > 0 && (
              <span>Bloquea a {selected.blocks.length} tarea(s). </span>
            )}
            {selected.estimateMinutes != null && (
              <span>Estimación: {selected.estimateMinutes} min. </span>
            )}
            {selected.dueDate && <span>Vence: {selected.dueDate}.</span>}
          </div>
        </div>
      )}

      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Nueva tarea"
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
              <strong>Nueva tarea</strong>
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
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                  }}
                >
                  {Object.entries(TYPE_LABEL).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 11, fontWeight: 600 }}>
                Prioridad
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                  }}
                >
                  {Object.entries(PRIORITY_LABEL).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 11, fontWeight: 600 }}>
                Nodo funcional (opcional)
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
                Descripción
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={4}
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
                  Crear tarea
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
