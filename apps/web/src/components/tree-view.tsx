'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Tabs, Tree, EmptyState, Pill, collectExpandableIds, type TreeItem } from '@devcycle/ui';
import { buildTree } from '@/lib/tree';
import { nodeStatusLabel, nodeStatusTone, timeAgo } from '@/lib/format';
import type {
  ChangeItem,
  DocumentItem,
  HistoryEntry,
  IssueItem,
  ProductNode,
  RelationDto,
  TaskItem,
} from '@/lib/types';

const DOC_STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  in_review: 'En revisión',
  published: 'Vigente',
  archived: 'Archivado',
};
const DOC_STATUS_TONE: Record<string, 'neutral' | 'warn' | 'ok'> = {
  draft: 'neutral',
  in_review: 'warn',
  published: 'ok',
  archived: 'neutral',
};

const NODE_TYPE_OPTIONS = [
  { key: 'modulo', label: 'Módulo' },
  { key: 'submodulo', label: 'Submódulo' },
  { key: 'pantalla', label: 'Pantalla' },
  { key: 'pestana', label: 'Pestaña' },
  { key: 'componente', label: 'Componente' },
  { key: 'proceso', label: 'Proceso' },
  { key: 'servicio', label: 'Servicio' },
  { key: 'otro', label: 'Otro' },
] as const;

const NODE_STATUS_OPTIONS = [
  { key: 'planned', label: 'Planificado' },
  { key: 'in_progress', label: 'En curso' },
  { key: 'done', label: 'Hecho' },
  { key: 'deprecated', label: 'Deprecado' },
  { key: 'disabled', label: 'Desactivado' },
] as const;

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

/** Formatea un doc vinculado como `CODIGO · título (vN)` navegable. */
function DocLink({ productSlug, doc }: { productSlug: string; doc: DocumentItem }) {
  return (
    <a
      href={`/products/${productSlug}/documentacion?doc=${doc.id}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <span className="mono">{doc.code ?? 'sin código'} ·</span> {doc.title} (v{doc.version})
    </a>
  );
}

function metadataSummary(doc: DocumentItem): string {
  const m = doc.metadata ?? {};
  switch (doc.docTypeKey) {
    case 'use_case': {
      const parts: string[] = [];
      if (m.actor) parts.push(`Actor: ${m.actor}`);
      if (m.goal) parts.push(`Objetivo: ${String(m.goal).slice(0, 80)}`);
      const flow = m.mainFlow as string[] | undefined;
      if (flow?.length) parts.push(`${flow.length} pasos`);
      return parts.join(' · ');
    }
    case 'business_rule': {
      const parts: string[] = [];
      if (m.condition) parts.push(`Si ${String(m.condition).slice(0, 60)}`);
      if (m.action) parts.push(`entonces ${String(m.action).slice(0, 60)}`);
      return parts.join(' ');
    }
    case 'req_non_functional': {
      const parts: string[] = [];
      if (m.category) parts.push(String(m.category));
      if (m.metric) parts.push(String(m.metric));
      if (m.threshold) parts.push(`≤/≥ ${m.threshold}`);
      return parts.join(' · ');
    }
    case 'workflow': {
      const steps = m.steps as { action: string }[] | undefined;
      const parts: string[] = [];
      if (m.trigger) parts.push(`Disparador: ${String(m.trigger).slice(0, 60)}`);
      if (steps?.length) parts.push(`${steps.length} pasos`);
      return parts.join(' · ');
    }
    default:
      return '';
  }
}

/**
 * Pestaña Funcionalidad (mockup `tab-funcionalidad`): objetivo propio del
 * nodo (migración 0008) + CU/reglas/RNF/flujos derivados de documentos
 * vinculados por `docTypeKey` (siguen siendo elementos documentales).
 */
function FuncionalidadTab({
  objective,
  hasDocs,
  productSlug,
  canWrite,
  onEdit,
  docsByType,
}: {
  objective: string | null;
  hasDocs: boolean;
  productSlug: string;
  canWrite: boolean;
  onEdit: () => void;
  docsByType: Map<string, DocumentItem[]>;
}) {
  const list = (key: string) => docsByType.get(key) ?? [];
  const secciones: Array<{ titulo: string; key: string; vacio: string }> = [
    { titulo: 'Casos de uso', key: 'use_case', vacio: 'Sin casos de uso vinculados' },
    { titulo: 'Reglas de negocio', key: 'business_rule', vacio: 'Sin reglas vinculadas' },
    {
      titulo: 'Requisitos no funcionales',
      key: 'req_non_functional',
      vacio: 'Sin requisitos no funcionales vinculados',
    },
    { titulo: 'Flujos', key: 'workflow', vacio: 'Sin flujos vinculados' },
  ];
  const hayComportamiento =
    Boolean(objective) || secciones.some((s) => list(s.key).length > 0) || hasDocs;

  if (!hayComportamiento) {
    return (
      <EmptyState
        title="Sin comportamiento documentado"
        description="Declara un objetivo funcional para este elemento. Los casos de uso, reglas, RNF y flujos se vinculan como documentos."
        action={
          canWrite ? (
            <button type="button" className="btn btn-sm btn-primary" onClick={onEdit}>
              Editar objetivo
            </button>
          ) : (
            <a
              className="btn btn-sm"
              href={`/products/${productSlug}/documentacion`}
              style={{ textDecoration: 'none' }}
            >
              Ir a Documentación
            </a>
          )
        }
      />
    );
  }

  return (
    <>
      <div className="panel-title">Comportamiento y reglas</div>
      <dl className="kv">
        <dt>Objetivo</dt>
        <dd>
          {objective ?? (
            <span>
              Sin objetivo declarado.
              {canWrite && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={onEdit}
                    style={{ marginLeft: 6 }}
                  >
                    Añadir
                  </button>
                </>
              )}
            </span>
          )}
        </dd>
        {secciones.map((s) => {
          const docs = list(s.key);
          return (
            <Fragment key={s.titulo}>
              <dt>{s.titulo}</dt>
              <dd>
                {docs.length === 0
                  ? s.vacio
                  : docs.map((d) => {
                      const summary = metadataSummary(d);
                      return (
                        <div key={d.id} style={{ marginBottom: 4 }}>
                          <DocLink productSlug={productSlug} doc={d} />
                          {summary && (
                            <div
                              style={{ fontSize: 11, color: 'var(--muted, #666)', marginTop: 2 }}
                            >
                              {summary}
                            </div>
                          )}
                        </div>
                      );
                    })}
              </dd>
            </Fragment>
          );
        })}
      </dl>
    </>
  );
}

const FICHA_TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'funcionalidad', label: 'Funcionalidad' },
  { id: 'documentacion', label: 'Documentación', badge: 0 },
  { id: 'tareas', label: 'Tareas', badge: 0 },
  { id: 'incidencias', label: 'Incidencias', badge: 0 },
  { id: 'relaciones', label: 'Relaciones', badge: 0 },
  { id: 'historial', label: 'Historial' },
];

function TreePage({
  productName,
  productSlug,
  initialNodes,
  initialNodeCode,
  canWrite,
}: {
  productName: string;
  productSlug: string;
  initialNodes: ProductNode[];
  initialNodeCode?: string;
  canWrite: boolean;
}) {
  const [nodes, setNodes] = useState<ProductNode[]>(initialNodes);
  const [selectedCode, setSelectedCode] = useState<string | null>(initialNodeCode ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    collectExpandableIds(buildTree(initialNodes)),
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newObjective, setNewObjective] = useState('');
  const [newTypeKey, setNewTypeKey] = useState('modulo');
  const [newParentId, setNewParentId] = useState('');
  const [newStatus, setNewStatus] = useState('planned');

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editObjective, setEditObjective] = useState('');
  const [editStatus, setEditStatus] = useState('planned');

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveParentId, setMoveParentId] = useState('');
  const [movePosition, setMovePosition] = useState('');

  const refreshNodes = useCallback(async () => {
    const data = await api<ProductNode[]>(`/api/v1/products/${productSlug}/nodes`);
    setNodes(data);
    setExpandedIds(collectExpandableIds(buildTree(data)));
    return data;
  }, [productSlug]);

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

  const openCreate = (parentId?: string) => {
    setNewParentId(parentId ?? '');
    setCreateOpen(true);
  };

  const handleCreate = () =>
    run(async () => {
      const created = await api<ProductNode>(`/api/v1/products/${productSlug}/nodes`, {
        method: 'POST',
        body: JSON.stringify({
          code: newCode.trim().toUpperCase(),
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          objective: newObjective.trim() || undefined,
          nodeTypeKey: newTypeKey,
          parentId: newParentId ? newParentId : null,
          status: newStatus,
        }),
      });
      await refreshNodes();
      setSelectedCode(created.code);
      window.history.replaceState(null, '', `?node=${encodeURIComponent(created.code)}`);
      setCreateOpen(false);
      setNewCode('');
      setNewName('');
      setNewDescription('');
      setNewObjective('');
    }, 'Nodo creado.');

  const handleEdit = () =>
    run(async () => {
      if (!selectedCode) return;
      const updated = await api<ProductNode>(
        `/api/v1/products/${productSlug}/nodes/${encodeURIComponent(selectedCode)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: editName.trim(),
            // `null` borra el campo (cadena vacía = sin dato).
            description: editDescription.trim() ? editDescription.trim() : null,
            objective: editObjective.trim() ? editObjective.trim() : null,
            status: editStatus,
          }),
        },
      );
      setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      setEditOpen(false);
    }, 'Nodo actualizado.');

  const handleMove = () =>
    run(async () => {
      if (!selectedCode) return;
      await api(`/api/v1/products/${productSlug}/nodes/${encodeURIComponent(selectedCode)}/move`, {
        method: 'POST',
        body: JSON.stringify({
          newParentId: moveParentId ? moveParentId : null,
          position: movePosition ? Number.parseInt(movePosition, 10) : undefined,
        }),
      });
      await refreshNodes();
      setMoveOpen(false);
    }, 'Nodo movido.');

  const handleDuplicate = () =>
    run(async () => {
      if (!selectedCode) return;
      await api(
        `/api/v1/products/${productSlug}/nodes/${encodeURIComponent(selectedCode)}/duplicate`,
        { method: 'POST' },
      );
      await refreshNodes();
    }, 'Subárbol duplicado.');

  const handleDeactivate = () =>
    run(async () => {
      if (!selectedCode) return;
      const ok = window.confirm(
        `¿Desactivar el subárbol desde ${selectedCode}? Esta acción oculta el nodo y sus descendientes.`,
      );
      if (!ok) return;
      await api(
        `/api/v1/products/${productSlug}/nodes/${encodeURIComponent(selectedCode)}/deactivate`,
        { method: 'POST' },
      );
      setSelectedCode(null);
      await refreshNodes();
    }, 'Subárbol desactivado.');

  const [activeTab, setActiveTab] = useState('resumen');
  const [typeFilter, setTypeFilter] = useState('');
  const [nodeDocs, setNodeDocs] = useState<DocumentItem[]>([]);
  const [nodeTasks, setNodeTasks] = useState<TaskItem[]>([]);
  const [nodeIssues, setNodeIssues] = useState<IssueItem[]>([]);
  const [nodeRelationsOut, setNodeRelationsOut] = useState<RelationDto[]>([]);
  const [nodeRelationsIn, setNodeRelationsIn] = useState<RelationDto[]>([]);
  const [nodeChanges, setNodeChanges] = useState<ChangeItem[]>([]);
  const [nodeHistory, setNodeHistory] = useState<HistoryEntry[]>([]);

  // Tipos presentes (para el filtro), con conteo.
  const typeCounts = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const node of nodes) {
      const entry = counts.get(node.nodeType.key) ?? { label: node.nodeType.label, count: 0 };
      entry.count += 1;
      counts.set(node.nodeType.key, entry);
    }
    return counts;
  }, [nodes]);

  const treeItems = useMemo<TreeItem[]>(() => {
    const visible = typeFilter ? nodes.filter((node) => node.nodeType.key === typeFilter) : nodes;
    return buildTree(visible);
  }, [nodes, typeFilter]);

  // Nodos visibles por id → el seleccionado.
  const visibleNodes = useMemo(
    () => (typeFilter ? nodes.filter((node) => node.nodeType.key === typeFilter) : nodes),
    [nodes, typeFilter],
  );
  const selectedNode =
    (selectedCode ? visibleNodes.find((node) => node.code === selectedCode) : null) ?? null;

  // Si el filtro oculta el seleccionado, limpiar la selección.
  useEffect(() => {
    if (selectedCode && !visibleNodes.some((node) => node.code === selectedCode)) {
      setSelectedCode(null);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [selectedCode, visibleNodes]);

  // Documentos del nodo seleccionado (pestaña Documentación, F2-T08).
  useEffect(() => {
    setNodeDocs([]);
    if (!selectedCode) return;
    let cancelled = false;
    fetch(`/api/v1/products/${productSlug}/nodes/${encodeURIComponent(selectedCode)}/documents`, {
      credentials: 'same-origin',
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: DocumentItem[]) => {
        if (!cancelled) setNodeDocs(data);
      })
      .catch(() => {
        if (!cancelled) setNodeDocs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCode, productSlug]);

  // Tareas + incidencias del nodo seleccionado (F3-T05: "crear desde ficha").
  useEffect(() => {
    setNodeTasks([]);
    setNodeIssues([]);
    if (!selectedCode) return;
    let cancelled = false;
    fetch(`/api/v1/products/${productSlug}/nodes/${encodeURIComponent(selectedCode)}/tasks`, {
      credentials: 'same-origin',
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: TaskItem[]) => {
        if (!cancelled) setNodeTasks(data);
      })
      .catch(() => {
        if (!cancelled) setNodeTasks([]);
      });
    fetch(`/api/v1/products/${productSlug}/nodes/${encodeURIComponent(selectedCode)}/issues`, {
      credentials: 'same-origin',
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: IssueItem[]) => {
        if (!cancelled) setNodeIssues(data);
      })
      .catch(() => {
        if (!cancelled) setNodeIssues([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCode, productSlug]);

  // Relaciones + historia del nodo (F4-T06: ficha → Relaciones/Historial funcionales).
  useEffect(() => {
    setNodeRelationsOut([]);
    setNodeRelationsIn([]);
    setNodeChanges([]);
    setNodeHistory([]);
    if (!selectedCode) return;
    let cancelled = false;
    const url = `/api/v1/products/${productSlug}/nodes/${encodeURIComponent(selectedCode)}`;
    fetch(`${url}/relations?direction=out`, { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: RelationDto[]) => {
        if (!cancelled) setNodeRelationsOut(data);
      })
      .catch(() => {
        if (!cancelled) setNodeRelationsOut([]);
      });
    fetch(`${url}/relations?direction=in`, { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: RelationDto[]) => {
        if (!cancelled) setNodeRelationsIn(data);
      })
      .catch(() => {
        if (!cancelled) setNodeRelationsIn([]);
      });
    fetch(`${url}/changes`, { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ChangeItem[]) => {
        if (!cancelled) setNodeChanges(data);
      })
      .catch(() => {
        if (!cancelled) setNodeChanges([]);
      });
    fetch(`${url}/history`, { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: HistoryEntry[]) => {
        if (!cancelled) setNodeHistory(data);
      })
      .catch(() => {
        if (!cancelled) setNodeHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCode, productSlug]);

  const selectNode = (node: TreeItem) => {
    setSelectedCode(node.code ?? null);
    // Sincroniza ?node= en la URL (shallow, sin re-render del servidor).
    window.history.replaceState(null, '', `?node=${encodeURIComponent(node.code ?? '')}`);
  };

  const selectedId = selectedNode?.id ?? null;

  const pathLabel = selectedNode ? selectedNode.path.split('.').join(' / ') : '';

  // Funcionalidad (mockup tab-funcionalidad): CU/reglas/RNF/flujos son
  // elementos documentales (prompt §5.2) — se derivan de los docs vinculados
  // por docTypeKey; objetivo y descripción son campos propios del nodo (0008).
  const docsByType = useMemo(() => {
    const grouped = new Map<string, DocumentItem[]>();
    for (const doc of nodeDocs) {
      const list = grouped.get(doc.docTypeKey) ?? [];
      list.push(doc);
      grouped.set(doc.docTypeKey, list);
    }
    return grouped;
  }, [nodeDocs]);

  const openEdit = () => {
    if (!selectedNode) return;
    setEditName(selectedNode.name);
    setEditDescription(selectedNode.description ?? '');
    setEditObjective(selectedNode.objective ?? '');
    setEditStatus(selectedNode.status);
    setEditOpen(true);
  };

  return (
    <>
      <div className="view-head">
        <div>
          <h1>Arquitectura funcional</h1>
          <p className="sub">
            Árbol configurable de módulos → submódulos → pantallas → pestañas → componentes ·{' '}
            <strong>{productName}</strong>
            {canWrite ? '' : ' · solo lectura (sin permiso nodes:write)'}
          </p>
        </div>
        <div className="spacer" />
        {canWrite && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openCreate(selectedNode?.id)}
          >
            + Nuevo nodo
          </button>
        )}
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

      <div className="split-tree">
        {/* ============ ÁRBOL ============ */}
        <div className="panel" aria-label="Árbol funcional del producto">
          <div className="tree-toolbar">
            <select
              className="filter-select"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              aria-label="Filtrar por tipo de nodo"
            >
              <option value="">Todos los tipos de nodo</option>
              {[...typeCounts.entries()].map(([key, { label, count }]) => (
                <option key={key} value={key}>
                  {label} ({count})
                </option>
              ))}
            </select>
            <button
              className="btn btn-sm btn-ghost"
              type="button"
              onClick={() => setExpandedIds(collectExpandableIds(treeItems))}
            >
              Expandir
            </button>
            <button
              className="btn btn-sm btn-ghost"
              type="button"
              onClick={() => setExpandedIds(new Set())}
            >
              Contraer
            </button>
            <button
              className="btn btn-sm btn-ghost"
              type="button"
              disabled={!canWrite || !selectedNode}
              title={canWrite ? 'Mover el nodo seleccionado' : 'Requiere permiso nodes:write'}
              onClick={() => {
                if (!selectedNode) return;
                setMoveParentId(selectedNode.parentId ?? '');
                setMovePosition('');
                setMoveOpen(true);
              }}
            >
              Mover
            </button>
            <button
              className="btn btn-sm btn-ghost"
              type="button"
              disabled={!canWrite || !selectedNode}
              title={
                canWrite ? 'Duplicar el subárbol seleccionado' : 'Requiere permiso nodes:write'
              }
              onClick={() => void handleDuplicate()}
            >
              Duplicar
            </button>
            <button
              className="btn btn-sm btn-danger-ghost"
              type="button"
              disabled={!canWrite || !selectedNode}
              title={
                canWrite ? 'Desactivar el subárbol seleccionado' : 'Requiere permiso nodes:write'
              }
              onClick={() => void handleDeactivate()}
            >
              Desactivar
            </button>
            {canWrite && selectedNode && (
              <button
                className="btn btn-sm btn-ghost"
                type="button"
                title="Crear un hijo bajo el nodo seleccionado"
                onClick={() => openCreate(selectedNode.id)}
              >
                + Hijo
              </button>
            )}
          </div>
          {nodes.length === 0 ? (
            <div style={{ padding: 12 }}>
              <EmptyState
                title="Árbol vacío"
                description={
                  canWrite
                    ? 'Este producto (p. ej. Urbania) aún no tiene nodos. Crea el primer módulo con «+ Nuevo nodo».'
                    : 'Este producto aún no tiene nodos. Pide el permiso nodes:write para crear el primero.'
                }
                action={
                  canWrite ? (
                    <button type="button" className="btn btn-primary" onClick={() => openCreate()}>
                      + Nuevo nodo
                    </button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <Tree
              items={treeItems}
              selectedId={selectedId}
              onSelect={selectNode}
              onExpandedIdsChange={setExpandedIds}
              expandedIds={expandedIds}
              ariaLabel="Árbol funcional"
            />
          )}
          <div className="tree-legend" id="nodeLegend">
            {[...typeCounts.entries()].map(([key, { label }]) => (
              <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 3,
                    background:
                      nodes.find((n) => n.nodeType.key === key)?.nodeType.color ?? '#94a3b8',
                  }}
                />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* ============ FICHA INTEGRAL ============ */}
        <div className="panel" aria-label="Ficha integral del elemento seleccionado">
          {selectedNode ? (
            <>
              <div className="ficha-head">
                <div
                  className="ficha-type"
                  style={{ background: selectedNode.nodeType.color ?? 'var(--accent)' }}
                  aria-hidden="true"
                >
                  {selectedNode.nodeType.label.charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                    {selectedNode.code}
                  </div>
                  <h2>{selectedNode.name}</h2>
                  <div className="ficha-meta">
                    <span className="type-dot">
                      <i style={{ background: selectedNode.nodeType.color ?? '#94a3b8' }} />
                      <span>{selectedNode.nodeType.label}</span>
                    </span>
                    <span>·</span>
                    <span>{pathLabel}</span>
                    <span>·</span>
                    <Pill tone={nodeStatusTone(selectedNode.status)}>
                      {nodeStatusLabel(selectedNode.status)}
                    </Pill>
                  </div>
                </div>
                <div className="ficha-actions">
                  <button
                    className="btn btn-sm"
                    type="button"
                    disabled={!canWrite}
                    title={
                      canWrite
                        ? 'Editar nombre, descripción, objetivo y estado'
                        : 'Requiere permiso nodes:write'
                    }
                    onClick={openEdit}
                  >
                    Editar
                  </button>
                  <button
                    className="btn btn-sm"
                    type="button"
                    onClick={() => setActiveTab('historial')}
                    title="Historia unificada del elemento (actividad + versiones + cambios)"
                  >
                    Historial
                  </button>
                </div>
              </div>

              <Tabs
                tabs={FICHA_TABS.map((tab) =>
                  tab.id === 'documentacion'
                    ? { ...tab, badge: nodeDocs.length }
                    : tab.id === 'tareas'
                      ? { ...tab, badge: nodeTasks.length }
                      : tab.id === 'incidencias'
                        ? { ...tab, badge: nodeIssues.length }
                        : tab.id === 'relaciones'
                          ? { ...tab, badge: nodeRelationsOut.length + nodeRelationsIn.length }
                          : tab,
                )}
                activeId={activeTab}
                onChange={setActiveTab}
                ariaLabel="Secciones de la ficha"
                className="ficha-tabs"
              />

              {activeTab === 'resumen' && (
                <div className="tab-panel active" role="tabpanel" id="panel-resumen">
                  {selectedNode.description ? (
                    <p style={{ fontSize: 12.5, lineHeight: 1.6, marginBottom: 12 }}>
                      {selectedNode.description}
                    </p>
                  ) : (
                    <EmptyState
                      title="Sin descripción funcional"
                      description="Declara una descripción breve de este elemento para que la ficha deje de estar vacía."
                      action={
                        canWrite ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={openEdit}
                          >
                            Editar descripción
                          </button>
                        ) : undefined
                      }
                    />
                  )}
                  <dl className="kv" style={{ marginTop: 12 }}>
                    <dt>Código</dt>
                    <dd className="mono">{selectedNode.code}</dd>
                    <dt>Responsable</dt>
                    <dd>{selectedNode.ownerId ? selectedNode.ownerId : 'Sin asignar'}</dd>
                    <dt>Profundidad</dt>
                    <dd>Nivel {selectedNode.depth} del árbol</dd>
                    <dt>Posición</dt>
                    <dd>{selectedNode.position + 1}º entre hermanos</dd>
                    <dt>Creado</dt>
                    <dd>{new Date(selectedNode.createdAt).toLocaleDateString('es-ES')}</dd>
                    <dt>Última modificación</dt>
                    <dd>{timeAgo(selectedNode.updatedAt)}</dd>
                    <dt>Camino</dt>
                    <dd className="mono">{selectedNode.path}</dd>
                    <dt>Versiones de doc.</dt>
                    <dd>
                      {nodeDocs.length === 0
                        ? 'Sin documentos vinculados'
                        : nodeDocs
                            .map((d) => `${d.code ?? 'sin código'} v${d.version}`)
                            .join(' · ')}
                    </dd>
                    <dt>Cubierta por pruebas</dt>
                    <dd>
                      Ver pestaña Documentación y Trazabilidad para casos de prueba vinculados.
                    </dd>
                  </dl>
                </div>
              )}
              {activeTab === 'funcionalidad' && (
                <div className="tab-panel active" role="tabpanel" id="panel-funcionalidad">
                  <FuncionalidadTab
                    objective={selectedNode.objective}
                    hasDocs={nodeDocs.length > 0}
                    productSlug={productSlug}
                    canWrite={canWrite}
                    onEdit={openEdit}
                    docsByType={docsByType}
                  />
                </div>
              )}
              {activeTab === 'documentacion' && (
                <div className="tab-panel active" role="tabpanel" id="panel-documentacion">
                  {nodeDocs.length === 0 ? (
                    <EmptyState
                      title="Sin documentos vinculados"
                      description="Vincula una especificación, caso de uso o regla de negocio a este nodo desde Documentación."
                      action={
                        <a
                          className="btn btn-sm"
                          href={`/products/${productSlug}/documentacion`}
                          style={{ textDecoration: 'none' }}
                        >
                          Ir a Documentación
                        </a>
                      }
                    />
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {nodeDocs.map((doc) => (
                          <a
                            key={doc.id}
                            href={`/products/${productSlug}/documentacion?doc=${doc.id}`}
                            className="doc-item"
                            style={{ textDecoration: 'none', color: 'inherit' }}
                          >
                            <div className="doc-icon" aria-hidden="true">
                              MD
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <h4>{doc.title}</h4>
                              <small>
                                {doc.code ?? 'sin código'} · {doc.docTypeLabel} · v{doc.version}
                              </small>
                              <br />
                              <small>{new Date(doc.updatedAt).toLocaleDateString('es-ES')}</small>
                            </div>
                            <span className="pill" style={{ marginLeft: 'auto' }}>
                              <span className={`pill-${DOC_STATUS_TONE[doc.status] ?? 'neutral'}`}>
                                {DOC_STATUS_LABEL[doc.status] ?? doc.status}
                              </span>
                            </span>
                          </a>
                        ))}
                      </div>
                      <a
                        className="btn btn-sm"
                        href={`/products/${productSlug}/documentacion`}
                        style={{ textDecoration: 'none', marginTop: 8 }}
                      >
                        + Adjuntar documento a este nodo
                      </a>
                    </>
                  )}
                </div>
              )}
              {activeTab === 'tareas' && (
                <div className="tab-panel active" role="tabpanel" id="panel-tareas">
                  {nodeTasks.length === 0 ? (
                    <EmptyState
                      title="0 tareas vinculadas"
                      description="Crea la primera tarea vinculada a este nodo desde Tareas o aquí."
                      action={
                        <a
                          className="btn btn-sm"
                          href={`/products/${productSlug}/tareas`}
                          style={{ textDecoration: 'none' }}
                        >
                          Ir a Tareas
                        </a>
                      }
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {nodeTasks.map((t) => (
                        <a
                          key={t.id}
                          href={`/products/${productSlug}/tareas`}
                          className="doc-item"
                          style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                          <div className="doc-icon" aria-hidden="true">
                            TAR
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <h4>{t.title}</h4>
                            <small>
                              {t.code ?? 'sin código'} · {t.stateLabel} · {t.priority}
                            </small>
                          </div>
                          <span className="pill pill-accent" style={{ marginLeft: 'auto' }}>
                            {t.stateLabel}
                          </span>
                        </a>
                      ))}
                      <a
                        className="btn btn-sm"
                        href={`/products/${productSlug}/tareas`}
                        style={{ textDecoration: 'none', marginTop: 8 }}
                      >
                        + Crear tarea vinculada
                      </a>
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'incidencias' && (
                <div className="tab-panel active" role="tabpanel" id="panel-incidencias">
                  {nodeIssues.length === 0 ? (
                    <EmptyState
                      title="0 incidencias vinculadas"
                      description="Reporta la primera incidencia en este nodo desde Incidencias."
                      action={
                        <a
                          className="btn btn-sm"
                          href={`/products/${productSlug}/incidencias`}
                          style={{ textDecoration: 'none' }}
                        >
                          Ir a Incidencias
                        </a>
                      }
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {nodeIssues.map((inc) => (
                        <a
                          key={inc.id}
                          href={`/products/${productSlug}/incidencias`}
                          className="doc-item"
                          style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                          <div className="doc-icon" aria-hidden="true">
                            INC
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <h4>{inc.title}</h4>
                            <small>
                              {inc.code ?? 'sin código'} · {inc.stateLabel} · {inc.severity}
                            </small>
                          </div>
                          <span className="pill pill-crit" style={{ marginLeft: 'auto' }}>
                            {inc.stateLabel}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'relaciones' && (
                <div className="tab-panel active" role="tabpanel" id="panel-relaciones">
                  <div className="panel-title">Relaciones salientes</div>
                  {nodeRelationsOut.length === 0 ? (
                    <EmptyState
                      title="0 relaciones salientes"
                      description="Vincula tareas, documentos o cambios desde su vista para verlos aquí."
                    />
                  ) : (
                    <div className="tbl-wrap">
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Origen</th>
                            <th>Relación</th>
                            <th>Destino</th>
                          </tr>
                        </thead>
                        <tbody>
                          {nodeRelationsOut.map((r) => (
                            <tr key={r.id}>
                              <td className="mono">
                                {r.sourceCode ?? `${r.sourceKind}:${r.sourceId.slice(0, 8)}`}
                              </td>
                              <td>
                                <span className="relation-tag">{r.relationType}</span>
                              </td>
                              <td className="mono">
                                {r.targetCode ?? `${r.targetKind}:${r.targetId.slice(0, 8)}`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="panel-title" style={{ marginTop: 12 }}>
                    Relaciones entrantes
                  </div>
                  {nodeRelationsIn.length === 0 ? (
                    <EmptyState
                      title="0 relaciones entrantes"
                      description="Nada apunta aún a este nodo. La trazabilidad completa vive en «Trazabilidad»."
                    />
                  ) : (
                    <div className="tbl-wrap">
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Origen</th>
                            <th>Relación</th>
                            <th>Destino</th>
                          </tr>
                        </thead>
                        <tbody>
                          {nodeRelationsIn.map((r) => (
                            <tr key={r.id}>
                              <td className="mono">
                                {r.sourceCode ?? `${r.sourceKind}:${r.sourceId.slice(0, 8)}`}
                              </td>
                              <td>
                                <span className="relation-tag">{r.relationType}</span>
                              </td>
                              <td className="mono">
                                {r.targetCode ?? `${r.targetKind}:${r.targetId.slice(0, 8)}`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <a
                    className="btn btn-sm"
                    href={`/products/${productSlug}/trazabilidad`}
                    style={{ textDecoration: 'none', marginTop: 8 }}
                  >
                    Abrir Trazabilidad
                  </a>
                </div>
              )}
              {activeTab === 'historial' && (
                <div className="tab-panel active" role="tabpanel" id="panel-historial">
                  {nodeChanges.length > 0 && (
                    <>
                      <div className="panel-title">Modificaciones del nodo</div>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          marginBottom: 12,
                        }}
                      >
                        {nodeChanges.map((c) => (
                          <a
                            key={c.id}
                            href={`/products/${productSlug}/modificaciones`}
                            className="doc-item"
                            style={{ textDecoration: 'none', color: 'inherit' }}
                          >
                            <div className="doc-icon" aria-hidden="true">
                              MOD
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <h4>{c.title}</h4>
                              <small>
                                {c.code ?? 'sin código'} ·{' '}
                                {c.status === 'executed' ? 'Ejecutado' : 'Propuesto'} ·{' '}
                                {c.kind === 'functional' ? 'Funcional' : 'Técnico'}
                                {c.gitSha ? ` · ${c.gitSha}` : ''}
                              </small>
                            </div>
                          </a>
                        ))}
                      </div>
                    </>
                  )}
                  {nodeHistory.length === 0 ? (
                    <EmptyState
                      title="Sin historia aún"
                      description="El timeline unificado (actividad + versiones + cambios) aparece aquí cuando hay operaciones sobre este nodo o sus elementos vinculados."
                    />
                  ) : (
                    <ul className="timeline">
                      {nodeHistory.map((h, i) => (
                        <li
                          key={`${h.at}-${h.action}-${i}`}
                          className={h.actorType === 'agent' ? 'ia' : ''}
                        >
                          <div className="t-time">{new Date(h.at).toLocaleString('es-ES')}</div>
                          <div className="t-text">
                            {h.summary}
                            <br />
                            <small style={{ color: 'var(--ink-3)' }}>
                              {h.actorType === 'agent'
                                ? 'AGENTE IA'
                                : h.actorType === 'system'
                                  ? 'SISTEMA'
                                  : 'HUMANO'}{' '}
                              · {h.action} ·{' '}
                              {h.source === 'version' ? 'versión documental' : 'actividad'}
                            </small>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: 24 }}>
              <EmptyState
                title="Selecciona un elemento del árbol"
                description="Elige cualquier módulo, pantalla o componente a la izquierda para ver su ficha integral (resumen, documentación, tareas, incidencias, relaciones e historial)."
              />
            </div>
          )}
        </div>
      </div>

      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Nuevo nodo"
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
              <strong>Nuevo nodo</strong>
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
                Código (p. ej. MOD-01, PANT-02)
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="MOD-01"
                  aria-label="Código del new nodo (p. ej. MOD-01, PANT-02)"
                  style={{
                    width: '100%',
                    marginTop: 4,
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                    fontFamily: 'var(--mono)',
                  }}
                />
                <span style={{ fontWeight: 400, color: 'var(--ink-3)', fontSize: 10 }}>
                  Formato: PREFIJO-NÚMERO, único en este producto (p. ej. MOD-01, PANT-02, CU-014).
                </span>
              </label>
              <label style={{ fontSize: 11, fontWeight: 600 }}>
                Nombre
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Módulo principal"
                  aria-label="Nombre del nuevo nodo"
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
                Descripción funcional (opcional)
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Descripción breve del elemento…"
                  aria-label="Descripción funcional del nuevo nodo"
                  rows={3}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
                <span style={{ fontWeight: 400, color: 'var(--ink-3)', fontSize: 10 }}>
                  Aparece en Resumen. Vacío = sin descripción.
                </span>
              </label>
              <label style={{ fontSize: 11, fontWeight: 600 }}>
                Objetivo funcional (opcional)
                <textarea
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  placeholder="Qué quiere conseguir este elemento…"
                  aria-label="Objetivo funcional del nuevo nodo"
                  rows={3}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
                <span style={{ fontWeight: 400, color: 'var(--ink-3)', fontSize: 10 }}>
                  Aparece en Funcionalidad. Vacío = sin objetivo.
                </span>
              </label>
              <label style={{ fontSize: 11, fontWeight: 600 }}>
                Tipo de nodo
                <select
                  value={newTypeKey}
                  onChange={(e) => setNewTypeKey(e.target.value)}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                  }}
                >
                  {NODE_TYPE_OPTIONS.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 11, fontWeight: 600 }}>
                Nodo padre
                <select
                  value={newParentId}
                  onChange={(e) => setNewParentId(e.target.value)}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                  }}
                >
                  <option value="">Sin padre (raíz)</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.code} · {n.name} ({n.nodeType.label})
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 11, fontWeight: 600 }}>
                Estado
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                  }}
                >
                  {NODE_STATUS_OPTIONS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!newCode.trim() || !newName.trim()}
                  onClick={() => void handleCreate()}
                >
                  Crear nodo
                </button>
                <button type="button" className="btn" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editOpen && selectedNode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Editar nodo"
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
              <strong>Editar nodo {selectedNode.code}</strong>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                style={{ marginLeft: 'auto' }}
                onClick={() => setEditOpen(false)}
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
                Nombre
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  aria-label="Nombre del nodo"
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
                Descripción funcional
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Descripción breve del elemento…"
                  aria-label="Descripción funcional del nodo"
                  rows={3}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
                <span style={{ fontWeight: 400, color: 'var(--ink-3)', fontSize: 10 }}>
                  Aparece en Resumen. Vaciar el texto la elimina.
                </span>
              </label>
              <label style={{ fontSize: 11, fontWeight: 600 }}>
                Objetivo funcional
                <textarea
                  value={editObjective}
                  onChange={(e) => setEditObjective(e.target.value)}
                  placeholder="Qué quiere conseguir este elemento…"
                  aria-label="Objetivo funcional del nodo"
                  rows={3}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
                <span style={{ fontWeight: 400, color: 'var(--ink-3)', fontSize: 10 }}>
                  Aparece en Funcionalidad. Vaciar el texto lo elimina.
                </span>
              </label>
              <label style={{ fontSize: 11, fontWeight: 600 }}>
                Estado
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                  }}
                >
                  {NODE_STATUS_OPTIONS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!editName.trim()}
                  onClick={() => void handleEdit()}
                >
                  Guardar
                </button>
                <button type="button" className="btn" onClick={() => setEditOpen(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {moveOpen && selectedNode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mover nodo"
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
              <strong>Mover nodo {selectedNode.code}</strong>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                style={{ marginLeft: 'auto' }}
                onClick={() => setMoveOpen(false)}
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
                Nuevo padre
                <select
                  value={moveParentId}
                  onChange={(e) => setMoveParentId(e.target.value)}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                  }}
                >
                  <option value="">Sin padre (raíz)</option>
                  {nodes
                    .filter((n) => n.id !== selectedNode.id)
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.code} · {n.name}
                      </option>
                    ))}
                </select>
                <span style={{ fontWeight: 400, color: 'var(--ink-3)', fontSize: 10 }}>
                  No puedes mover un nodo dentro de sí mismo ni de uno de sus descendientes.
                </span>
              </label>
              <label style={{ fontSize: 11, fontWeight: 600 }}>
                Posición entre hermanos (opcional)
                <input
                  type="number"
                  min={0}
                  value={movePosition}
                  onChange={(e) => setMovePosition(e.target.value)}
                  placeholder="Automática (al final)"
                  style={{
                    width: '100%',
                    marginTop: 4,
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                  }}
                />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-primary" onClick={() => void handleMove()}>
                  Mover
                </button>
                <button type="button" className="btn" onClick={() => setMoveOpen(false)}>
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

export function ArbolView({
  productName,
  productSlug,
  nodes,
  initialNodeCode,
  canWrite,
}: {
  productName: string;
  productSlug: string;
  nodes: ProductNode[];
  initialNodeCode?: string;
  canWrite?: boolean;
}) {
  const props = {
    productName,
    productSlug,
    initialNodes: nodes,
    ...(initialNodeCode ? { initialNodeCode } : {}),
    canWrite: canWrite ?? false,
  };
  return <TreePage {...props} />;
}
