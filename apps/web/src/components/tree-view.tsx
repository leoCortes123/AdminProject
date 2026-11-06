'use client';

import { useEffect, useMemo, useState } from 'react';
import { Tabs, Tree, EmptyState, Pill, collectExpandableIds, type TreeItem } from '@devcycle/ui';
import { buildTree } from '@/lib/tree';
import { nodeStatusLabel, nodeStatusTone, timeAgo } from '@/lib/format';
import type { ProductNode } from '@/lib/types';

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
  nodes,
  initialNodeCode,
}: {
  productName: string;
  nodes: ProductNode[];
  initialNodeCode?: string;
}) {
  const [selectedCode, setSelectedCode] = useState<string | null>(initialNodeCode ?? null);

  const [activeTab, setActiveTab] = useState('resumen');
  const [typeFilter, setTypeFilter] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    collectExpandableIds(buildTree(nodes)),
  );

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

  const selectNode = (node: TreeItem) => {
    setSelectedCode(node.code ?? null);
    // Sincroniza ?node= en la URL (shallow, sin re-render del servidor).
    window.history.replaceState(null, '', `?node=${encodeURIComponent(node.code ?? '')}`);
  };

  const selectedId = selectedNode?.id ?? null;

  const pathLabel = selectedNode ? selectedNode.path.split('.').join(' / ') : '';

  return (
    <>
      <div className="view-head">
        <div>
          <h1>Arquitectura funcional</h1>
          <p className="sub">
            Árbol configurable de módulos → submódulos → pantallas → pestañas → componentes ·{' '}
            <strong>{productName}</strong> · modo lectura
          </p>
        </div>
        <div className="spacer" />
        <button
          type="button"
          className="btn btn-primary"
          disabled
          title="La edición del árbol llega en una fase posterior (la API ya lo soporta)"
        >
          + Nuevo nodo
        </button>
      </div>

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
              disabled
              title="Disponible en una fase posterior (la API ya lo soporta)"
            >
              Mover
            </button>
            <button
              className="btn btn-sm btn-ghost"
              type="button"
              disabled
              title="Disponible en una fase posterior (la API ya lo soporta)"
            >
              Duplicar
            </button>
            <button
              className="btn btn-sm btn-danger-ghost"
              type="button"
              disabled
              title="Disponible en una fase posterior (la API ya lo soporta)"
            >
              Desactivar
            </button>
          </div>
          {nodes.length === 0 ? (
            <div style={{ padding: 12 }}>
              <EmptyState
                title="Árbol vacío"
                description="Este producto aún no tiene nodos. En Fase 2 podrás crear módulos y pantallas desde la UI (la API ya expone CRUD completo)."
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
                    disabled
                    title="Disponible en una fase posterior"
                  >
                    Editar
                  </button>
                  <button
                    className="btn btn-sm"
                    type="button"
                    disabled
                    title="Historial completo llega en Fase 4 (activity_log ya registra cambios)"
                  >
                    Historial
                  </button>
                </div>
              </div>

              <Tabs
                tabs={FICHA_TABS}
                activeId={activeTab}
                onChange={setActiveTab}
                ariaLabel="Secciones de la ficha"
                className="ficha-tabs"
              />

              {activeTab === 'resumen' && (
                <div className="tab-panel active" role="tabpanel" id="panel-resumen">
                  <EmptyState
                    title="Sin descripción funcional"
                    description="La descripción y los metadatos funcionales de cada elemento llegan con la Fase 2 (documentación vinculada al árbol)."
                  />
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
                  </dl>
                </div>
              )}
              {activeTab === 'funcionalidad' && (
                <div className="tab-panel active" role="tabpanel" id="panel-funcionalidad">
                  <EmptyState
                    title="Sin comportamiento documentado"
                    description="Objetivo, casos de uso, reglas de negocio y flujos llegan con la Fase 2."
                  />
                </div>
              )}
              {activeTab === 'documentacion' && (
                <div className="tab-panel active" role="tabpanel" id="panel-documentacion">
                  <EmptyState
                    title="0 documentos vinculados"
                    description="La documentación (13 tipos, versionada y vinculada a este nodo) llega con la Fase 2."
                  />
                </div>
              )}
              {activeTab === 'tareas' && (
                <div className="tab-panel active" role="tabpanel" id="panel-tareas">
                  <EmptyState
                    title="0 tareas vinculadas"
                    description="Las tareas ligadas a este elemento llegan con la Fase 3."
                  />
                </div>
              )}
              {activeTab === 'incidencias' && (
                <div className="tab-panel active" role="tabpanel" id="panel-incidencias">
                  <EmptyState
                    title="0 incidencias vinculadas"
                    description="Las incidencias llegan con la Fase 3."
                  />
                </div>
              )}
              {activeTab === 'relaciones' && (
                <div className="tab-panel active" role="tabpanel" id="panel-relaciones">
                  <EmptyState
                    title="0 relaciones"
                    description="El grafo de relaciones bidireccionales llega con la Fase 4 (trazabilidad)."
                  />
                </div>
              )}
              {activeTab === 'historial' && (
                <div className="tab-panel active" role="tabpanel" id="panel-historial">
                  <EmptyState
                    title="Historial aún no visible"
                    description="El timeline unificado (actividad + versiones + cambios) llega con la Fase 4. Mientras tanto, las operaciones sobre el árbol quedan registradas en activity_log vía API."
                  />
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
    </>
  );
}

export function ArbolView({
  productName,
  nodes,
  initialNodeCode,
}: {
  productName: string;
  nodes: ProductNode[];
  initialNodeCode?: string;
}) {
  const props = { productName, nodes, ...(initialNodeCode ? { initialNodeCode } : {}) };
  return <TreePage {...props} />;
}
