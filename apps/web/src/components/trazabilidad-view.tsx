'use client';

import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@devcycle/ui';
import type { DocumentItem, ProductNode, TraceGraph, TraceRow } from '@/lib/types';

const QUERIES = [
  {
    id: 'tasks-affecting-node',
    label: '¿Qué tareas afectan esta pantalla?',
    needs: 'node' as const,
  },
  {
    id: 'screens-using-rule',
    label: '¿Qué pantallas utilizan esta regla?',
    needs: 'item' as const,
  },
  {
    id: 'documents-for-node',
    label: '¿Qué documentos describen este proceso?',
    needs: 'node' as const,
  },
  {
    id: 'changes-for-node',
    label: '¿Qué modificaciones implementaron esta funcionalidad?',
    needs: 'node' as const,
  },
  {
    id: 'tests-for-document',
    label: '¿Qué pruebas validan este caso de uso?',
    needs: 'item' as const,
  },
  {
    id: 'issues-for-module',
    label: '¿Qué incidencias afectan este módulo?',
    needs: 'node' as const,
  },
  {
    id: 'dependents-for-node',
    label: '¿Qué funcionalidades dependen de este componente?',
    needs: 'node' as const,
  },
];

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

function GraphSvg({ graph }: { graph: TraceGraph }) {
  const center = graph.center;
  // Posiciones deterministas en círculo alrededor del centro (460×380, como el mockup).
  const cx = 230;
  const cy = 190;
  const neighbors = graph.nodes.filter((n) => !(n.kind === center.kind && n.id === center.id));
  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    neighbors.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(neighbors.length, 1) - Math.PI / 2;
      const r = 150;
      map.set(`${n.kind}:${n.id}`, {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      });
    });
    return map;
  }, [neighbors]);

  return (
    <svg
      width="100%"
      viewBox="0 0 460 380"
      role="img"
      aria-label={`Grafo de relaciones de ${center.code ?? center.title}`}
    >
      <g stroke="#c7cbe0" strokeWidth="2">
        {graph.edges.map((e, i) => {
          const a =
            e.source.startsWith('node:') && e.source === `node:${center.id}`
              ? { x: cx, y: cy }
              : positions.get(e.source);
          const b = positions.get(e.target) ?? { x: cx, y: cy };
          const from = a ?? { x: cx, y: cy };
          const to = b;
          return <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
        })}
      </g>
      <g fontFamily="ui-monospace,Menlo,monospace" fontSize="9" fill="#7c3aed">
        {graph.edges.map((e, i) => {
          const a =
            positions.get(e.source) ?? (e.source === `node:${center.id}` ? { x: cx, y: cy } : null);
          const b = positions.get(e.target) ?? { x: cx, y: cy };
          if (!a) return null;
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          return (
            <text key={i} x={mx} y={my}>
              {e.type}
            </text>
          );
        })}
      </g>
      <g>
        <rect x={cx - 70} y={cy - 28} width="140" height="56" rx="10" fill="#4f46e5" />
        <text
          x={cx}
          y={cy - 5}
          textAnchor="middle"
          fill="#fff"
          fontSize="11"
          fontWeight="700"
          fontFamily="Inter,sans-serif"
        >
          {center.code ?? 'Nodo'}
        </text>
        <text
          x={cx}
          y={cy + 13}
          textAnchor="middle"
          fill="#c7d2fe"
          fontSize="9.5"
          fontFamily="Inter,sans-serif"
        >
          {center.title}
        </text>
      </g>
      <g fontFamily="Inter,sans-serif" fontSize="9.5">
        {neighbors.map((n) => {
          const p = positions.get(`${n.kind}:${n.id}`) ?? { x: cx, y: cy };
          const label = `${n.code ?? n.kind.toUpperCase()} · ${(n.title ?? '').slice(0, 18)}`;
          return (
            <g key={`${n.kind}-${n.id}`}>
              <rect
                x={p.x - 52}
                y={p.y - 17}
                width="104"
                height="34"
                rx="8"
                fill="#eef0fe"
                stroke="#a5b4fc"
              />
              <text x={p.x} y={p.y - 2} textAnchor="middle" fontWeight="700" fill="#3730a3">
                {label}
              </text>
              <text x={p.x} y={p.y + 11} textAnchor="middle" fill="#5b6474">
                {n.kind}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export function TrazabilidadView({
  slug,
  productName,
  nodes,
  documents,
}: {
  slug: string;
  productName: string;
  nodes: ProductNode[];
  documents: DocumentItem[];
}) {
  const [queryId, setQueryId] = useState('tasks-affecting-node');
  const [nodeCode, setNodeCode] = useState(
    nodes.find((n) => n.code === 'PANT-02')?.code ?? nodes[0]?.code ?? '',
  );
  const [itemCode, setItemCode] = useState(documents[0]?.code ?? '');
  const [rows, setRows] = useState<TraceRow[]>([]);
  const [graph, setGraph] = useState<TraceGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const activeQuery = QUERIES.find((q) => q.id === queryId) ?? QUERIES[0]!;

  const runQuery = async () => {
    setError(null);
    setLoading(true);
    try {
      const base = `/api/v1/products/${slug}/trace/${queryId}`;
      const params = new URLSearchParams();
      if (activeQuery.needs === 'node') {
        if (!nodeCode) throw new Error('Selecciona un nodo');
        params.set('nodeCode', nodeCode);
      } else {
        if (!itemCode) throw new Error('Selecciona un documento');
        params.set('itemCode', itemCode);
      }
      const data = await api<TraceRow[]>(`${base}?${params.toString()}`);
      setRows(data);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (nodeCode) {
      api<TraceGraph>(
        `/api/v1/products/${slug}/trace/graph?nodeCode=${encodeURIComponent(nodeCode)}&depth=1`,
      )
        .then(setGraph)
        .catch(() => setGraph(null));
    } else {
      setGraph(null);
    }
  }, [nodeCode, slug]);

  const destinationLabel = useMemo(() => {
    if (activeQuery.needs === 'node') {
      const node = nodes.find((n) => n.code === nodeCode);
      return node ? `${node.code} · ${node.name}` : nodeCode;
    }
    const doc = documents.find((d) => d.code === itemCode);
    return doc ? `${doc.code ?? ''} · ${doc.title}` : itemCode;
  }, [activeQuery.needs, nodeCode, itemCode, nodes, documents]);

  return (
    <>
      <div className="view-head">
        <div>
          <h1>Trazabilidad</h1>
          <p className="sub">
            Relaciones entre elementos desde cualquier dirección — sin límite jerárquico ·{' '}
            <strong>{productName}</strong>
          </p>
        </div>
      </div>

      <div className="split-2">
        <div>
          <div className="panel panel-pad">
            <div className="panel-title">
              Consultas frecuentes <span className="count">7</span>
            </div>
            <div
              role="group"
              aria-label="Consultas de trazabilidad"
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              {QUERIES.map((q, i) => (
                <button
                  key={q.id}
                  type="button"
                  className={`query-item ${queryId === q.id ? 'active' : ''}`}
                  onClick={() => {
                    setQueryId(q.id);
                    setRows([]);
                    setError(null);
                  }}
                  aria-pressed={queryId === q.id}
                >
                  <span className="q-num">Q{i + 1}</span>
                  <span>{q.label}</span>
                </button>
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              {activeQuery.needs === 'node' ? (
                <select
                  value={nodeCode}
                  onChange={(e) => setNodeCode(e.target.value)}
                  aria-label="Nodo para la consulta"
                  style={{
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                    fontSize: 12,
                  }}
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.code}>
                      {n.code} · {n.name}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value)}
                  aria-label="Documento para la consulta"
                  style={{
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                    fontSize: 12,
                  }}
                >
                  {documents.map((d) => (
                    <option key={d.id} value={d.code ?? ''}>
                      {d.code ?? 'DOC'} · {d.title}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                className="btn btn-primary"
                disabled={loading}
                onClick={() => void runQuery()}
              >
                {loading ? 'Consultando…' : 'Ejecutar consulta'}
              </button>
            </div>
          </div>

          <div className="panel panel-pad" style={{ marginTop: 14 }}>
            <div className="panel-title">Resultado</div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 8 }}>
              <strong>{destinationLabel}</strong> · {rows.length} resultado(s)
            </div>
            {error && (
              <div className="org-banner" role="alert" style={{ display: 'flex', marginBottom: 8 }}>
                {error}
              </div>
            )}
            <div className="tbl-wrap">
              <table className="tbl" aria-label="Resultados de la consulta">
                <thead>
                  <tr>
                    <th scope="col">Elemento</th>
                    <th scope="col">Descripción</th>
                    <th scope="col">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && !error && (
                    <tr>
                      <td colSpan={3} style={{ color: 'var(--ink-3)' }}>
                        Selecciona una consulta y pulsa «Ejecutar consulta»…
                      </td>
                    </tr>
                  )}
                  {rows.map((r) => (
                    <tr key={`${r.kind}-${r.id}`}>
                      <td className="mono">
                        {r.code ?? `${r.kind.toUpperCase()}-${r.id.slice(0, 6)}`}
                      </td>
                      <td style={{ maxWidth: 320, whiteSpace: 'normal' }}>{r.title}</td>
                      <td>{r.subtitle}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div
          className="panel panel-pad trace-map"
          aria-label={`Grafo de relaciones de ${destinationLabel}`}
        >
          <div className="panel-title">Grafo de relaciones · {nodeCode || '—'}</div>
          {graph ? (
            <>
              <GraphSvg graph={graph} />
              <p style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 6 }}>
                Relaciones polimórficas con integridad referencial (tabla relations). El grafo es
                navegable: cada nodo abre su ficha integral.
              </p>
            </>
          ) : (
            <EmptyState
              title="Sin grafo disponible"
              description="Selecciona un nodo para ver sus relaciones con tareas, documentos, incidencias y modificaciones."
            />
          )}
        </div>
      </div>
    </>
  );
}
