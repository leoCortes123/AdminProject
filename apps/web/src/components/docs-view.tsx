'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState, type PillTone } from '@devcycle/ui';
import { MarkdownEditor } from '@/components/markdown-editor';
import { renderMarkdown } from '@/lib/markdown';
import { diffMarkdown, diffStats } from '@/lib/diff';
import type {
  AttachmentInfo,
  DocRelation,
  DocumentItem,
  DocumentType,
  DocumentVersion,
  ProductNode,
} from '@/lib/types';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  in_review: 'En revisión',
  published: 'Vigente',
  archived: 'Archivado',
};
const STATUS_TONE: Record<string, PillTone> = {
  draft: 'neutral',
  in_review: 'warn',
  published: 'ok',
  archived: 'neutral',
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

export function DocsView({
  slug,
  productName,
  initialDocs,
  types,
  nodes,
  initialDocId,
  canWrite,
  canPublish,
}: {
  slug: string;
  productName: string;
  initialDocs: DocumentItem[];
  types: DocumentType[];
  nodes: ProductNode[];
  initialDocId?: string;
  canWrite: boolean;
  canPublish: boolean;
}) {
  const base = `/api/v1/products/${slug}/documents`;
  const [docs, setDocs] = useState<DocumentItem[]>(initialDocs);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialDocId ?? initialDocs[0]?.id ?? null,
  );
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editMode, setEditMode] = useState<'preview' | 'edit'>('preview');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftTypeKey, setDraftTypeKey] = useState('');
  const [saveState, setSaveState] = useState<string>('');

  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [viewVersion, setViewVersion] = useState<number | null>(null);
  const [compareFrom, setCompareFrom] = useState<number | null>(null);
  const [compareTo, setCompareTo] = useState<number | null>(null);
  const [attachments, setAttachments] = useState<AttachmentInfo[]>([]);
  const [relations, setRelations] = useState<DocRelation[]>([]);
  const [newRelationTarget, setNewRelationTarget] = useState('');
  const [newRelationType, setNewRelationType] = useState('specifies');
  const [linkNodeCode, setLinkNodeCode] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [newTypeKey, setNewTypeKey] = useState(types[0]?.key ?? 'spec');
  const [newTitle, setNewTitle] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newNodeCode, setNewNodeCode] = useState('');

  const selected = docs.find((doc) => doc.id === selectedId) ?? null;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshDocs = useCallback(async () => {
    try {
      const data = await api<DocumentItem[]>(base);
      setDocs(data);
      return data;
    } catch (err) {
      setError(errorMessage(err));
      return null;
    }
  }, [base]);

  const refreshSub = useCallback(
    async (docId: string) => {
      try {
        const [vers, atts, rels] = await Promise.all([
          api<DocumentVersion[]>(`${base}/${docId}/versions`),
          api<AttachmentInfo[]>(
            `/api/v1/products/${slug}/attachments?ownerId=${encodeURIComponent(docId)}`,
          ),
          api<DocRelation[]>(`${base}/${docId}/relations?direction=both`),
        ]);
        setVersions(vers);
        setAttachments(atts);
        setRelations(rels);
      } catch (err) {
        setError(errorMessage(err));
      }
    },
    [base, slug],
  );

  // Al seleccionar un documento: cargar sub-recursos + preparar el borrador de edición.
  useEffect(() => {
    if (!selected) return;
    void refreshSub(selected.id);
    setViewVersion(null);
    setCompareFrom(null);
    setCompareTo(null);
    setEditing(false);
    setEditMode('preview');
    setDraftTitle(selected.title);
    setDraftBody(selected.bodyMarkdown);
    setDraftTypeKey(selected.docTypeKey);
    // Borrador local (F2-T04: autosave local con debounce, sin subir a servidor).
    try {
      const raw = localStorage.getItem(`devcycle:doc:draft:${selected.id}`);
      if (raw) {
        const local = JSON.parse(raw) as { body?: string; savedAt?: string };
        if (local.body && local.body !== selected.bodyMarkdown) {
          setSaveState(
            `Borrador local sin guardar (${local.savedAt ?? ''}) — edítalo para restaurarlo.`,
          );
        }
      }
    } catch {
      /* localStorage no disponible */
    }
  }, [selected?.id, refreshSub]);

  // Autosave local con debounce (500 ms) mientras se edita.
  useEffect(() => {
    if (!editing || !selected) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(
          `devcycle:doc:draft:${selected.id}`,
          JSON.stringify({
            body: draftBody,
            title: draftTitle,
            savedAt: new Date().toLocaleTimeString('es-ES'),
          }),
        );
        setSaveState('Borrador local guardado.');
      } catch {
        /* sin localStorage */
      }
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [editing, selected, draftBody, draftTitle]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((doc) => {
      if (typeFilter && doc.docTypeKey !== typeFilter) return false;
      if (statusFilter && doc.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [doc.title, doc.code ?? '', doc.bodyMarkdown, ...doc.nodeCodes]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [docs, typeFilter, statusFilter, query]);

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

  const handleSave = () =>
    run(async () => {
      if (!selected) return;
      const updated = await api<DocumentItem>(`${base}/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: draftTitle,
          bodyMarkdown: draftBody,
          docTypeKey: draftTypeKey,
          expectedVersion: selected.version,
        }),
      });
      try {
        localStorage.removeItem(`devcycle:doc:draft:${selected.id}`);
      } catch {
        /* noop */
      }
      setDocs((prev) => prev.map((doc) => (doc.id === updated.id ? updated : doc)));
      setEditing(false);
      setEditMode('preview');
      setSaveState('');
      void refreshSub(updated.id);
    }, 'Cambios guardados (el versionado se crea al publicar o con «Crear versión»).');

  const handleTransition = (toStatus: string) =>
    run(
      async () => {
        if (!selected) return;
        const updated = await api<DocumentItem>(`${base}/${selected.id}/transition`, {
          method: 'POST',
          body: JSON.stringify({ toStatus }),
        });
        setDocs((prev) => prev.map((doc) => (doc.id === updated.id ? updated : doc)));
      },
      `Estado actualizado a ${STATUS_LABEL[toStatus] ?? toStatus}.`,
    );

  const handlePublish = () =>
    run(
      async () => {
        if (!selected) return;
        const promptNote = window.prompt('Nota de la publicación (opcional):', '');
        const updated = await api<DocumentItem>(`${base}/${selected.id}/publish`, {
          method: 'POST',
          body: JSON.stringify(promptNote ? { changeNote: promptNote } : {}),
        });
        setDocs((prev) => prev.map((doc) => (doc.id === updated.id ? updated : doc)));
        setViewVersion(null);
        void refreshSub(updated.id);
      },
      `Publicado como v${selected ? selected.version + 1 : ''}.`,
    );

  const handleCreateVersion = () =>
    run(async () => {
      if (!selected) return;
      const created = await api<DocumentVersion>(`${base}/${selected.id}/versions`, {
        method: 'POST',
        body: JSON.stringify({ changeNote: `Snapshot manual`, expectedVersion: selected.version }),
      });
      setDocs((prev) =>
        prev.map((doc) => (doc.id === selected.id ? { ...doc, version: created.version } : doc)),
      );
      void refreshSub(created.itemId);
    }, 'Snapshot de versión creado.');

  const handleCreate = () =>
    run(async () => {
      const created = await api<DocumentItem>(base, {
        method: 'POST',
        body: JSON.stringify({
          docTypeKey: newTypeKey,
          code: newCode.trim() ? newCode.trim() : null,
          title: newTitle,
          bodyMarkdown: newBody,
          nodeCodes: newNodeCode ? [newNodeCode] : [],
        }),
      });
      setDocs((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setCreateOpen(false);
      setNewTitle('');
      setNewCode('');
      setNewBody('');
      setNewNodeCode('');
    }, 'Documento creado en borrador (v1).');

  const viewedVersion = versions.find((v) => v.version === viewVersion) ?? null;
  const previewBody = viewedVersion
    ? viewedVersion.bodyMarkdown
    : editing
      ? draftBody
      : (selected?.bodyMarkdown ?? '');
  const previewTitle = viewedVersion ? viewedVersion.title : draftTitle || selected?.title;

  const compareParts = useMemo(() => {
    if (!compareFrom || !compareTo) return null;
    const from = versions.find((v) => v.version === compareFrom);
    const to = versions.find((v) => v.version === compareTo);
    if (!from || !to) return null;
    return {
      from,
      to,
      parts: diffMarkdown(from.bodyMarkdown, to.bodyMarkdown),
      stats: diffStats(from.bodyMarkdown, to.bodyMarkdown),
    };
  }, [versions, compareFrom, compareTo]);

  const exportMarkdown = () => {
    const text = docs
      .map(
        (doc) =>
          `<!-- ${doc.code ?? doc.id} · ${doc.docTypeLabel} · ${STATUS_LABEL[doc.status] ?? doc.status} · v${doc.version} -->\n# ${doc.title}\n\n${doc.bodyMarkdown}\n`,
      )
      .join('\n---\n\n');
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slug}-documentacion.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="view-head">
        <div>
          <h1>Documentación</h1>
          <p className="sub">
            Especificaciones, casos de uso, reglas, contratos, ADRs… versionados y vinculados al
            árbol funcional · <strong>{productName}</strong>
          </p>
        </div>
        <div className="spacer" />
        <button type="button" className="btn" onClick={exportMarkdown} disabled={docs.length === 0}>
          Exportar a Markdown
        </button>
        {canWrite && (
          <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            + Nuevo documento
          </button>
        )}
      </div>

      <div className="filter-bar">
        <span className="lbl">Tipo</span>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filtrar por tipo documental"
        >
          <option value="">Todos los tipos ({types.length})</option>
          {types.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        <span className="lbl">Estado</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos</option>
          <option value="draft">Borrador</option>
          <option value="in_review">En revisión</option>
          <option value="published">Vigente</option>
          <option value="archived">Archivado</option>
        </select>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en título, código, nodo…"
          aria-label="Buscar documento"
        />
        <span className="lbl" style={{ marginLeft: 'auto' }}>
          {filtered.length} de {docs.length} documentos
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
            Documentos del producto <span className="count">{filtered.length}</span>
          </div>
          <div>
            {filtered.map((doc) => (
              <button
                key={doc.id}
                type="button"
                className="doc-item"
                data-doc={doc.id}
                onClick={() => setSelectedId(doc.id)}
                aria-current={doc.id === selectedId}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer',
                  background: doc.id === selectedId ? 'var(--accent-soft)' : '#fff',
                  borderColor: doc.id === selectedId ? 'var(--accent)' : undefined,
                }}
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
                  <small>
                    {doc.nodeCodes.length > 0 ? doc.nodeCodes.join(', ') : 'global / sin nodo'} ·{' '}
                    {new Date(doc.updatedAt).toLocaleDateString('es-ES')}
                  </small>
                </div>
                <span className="pill" style={{ marginLeft: 'auto' }}>
                  <span className={`pill-${STATUS_TONE[doc.status] ?? 'neutral'}`}>
                    {STATUS_LABEL[doc.status] ?? doc.status}
                  </span>
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <EmptyState
                title="Ningún documento coincide con el filtro"
                description={
                  docs.length === 0
                    ? 'Aún no hay documentación. Crea el primer documento para empezar a documentar el árbol funcional.'
                    : 'Prueba con otros filtros o un término de búsqueda distinto.'
                }
              />
            )}
          </div>
        </div>

        <div className="panel" aria-label="Vista previa del documento">
          {selected ? (
            <>
              <div
                className="panel-pad"
                style={{
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="mono" style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>
                    {selected.code ?? selected.id.slice(0, 8)} · v{selected.version}
                    {viewVersion ? ` (viendo v${viewVersion})` : ''}
                  </div>
                  <strong style={{ fontSize: 13 }}>{previewTitle}</strong>
                  <div style={{ color: 'var(--ink-2)', fontSize: 10.5, marginTop: 2 }}>
                    {selected.docTypeLabel} · {selected.nodeCodes.join(', ') || 'sin nodo'} ·{' '}
                    {STATUS_LABEL[selected.status]} · actualizado{' '}
                    {new Date(selected.updatedAt).toLocaleString('es-ES')}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setEditMode(editMode === 'preview' ? 'edit' : 'preview')}
                  >
                    {editMode === 'preview' ? 'Editar (Markdown)' : 'Vista previa'}
                  </button>
                  {canWrite && selected.status === 'draft' && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => void handleTransition('in_review')}
                    >
                      Enviar a revisión
                    </button>
                  )}
                  {canWrite && selected.status === 'in_review' && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => void handleTransition('draft')}
                    >
                      Devolver a borrador
                    </button>
                  )}
                  {canWrite && selected.status !== 'archived' && (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => void handlePublish()}
                      disabled={!canPublish}
                      title={
                        canPublish
                          ? 'Publica creando la siguiente versión (inmutable)'
                          : 'Publicar requiere el permiso docs:publish (Administrador de producto o global)'
                      }
                    >
                      {selected.status === 'published' ? 'Publicar nueva versión' : 'Publicar'}
                    </button>
                  )}
                  {canWrite && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => void handleCreateVersion()}
                    >
                      Crear versión
                    </button>
                  )}
                </div>
              </div>

              {editMode === 'edit' && canWrite ? (
                <div className="panel-pad">
                  <label
                    style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}
                  >
                    Título
                    <input
                      type="text"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      style={{
                        width: '100%',
                        marginTop: 4,
                        border: '1px solid var(--line-strong)',
                        borderRadius: 7,
                        padding: '6px 8px',
                      }}
                    />
                  </label>
                  <label
                    style={{ display: 'block', fontSize: 11, fontWeight: 600, margin: '8px 0 4px' }}
                  >
                    Tipo documental
                    <select
                      value={draftTypeKey}
                      onChange={(e) => setDraftTypeKey(e.target.value)}
                      style={{
                        width: '100%',
                        marginTop: 4,
                        border: '1px solid var(--line-strong)',
                        borderRadius: 7,
                        padding: '6px 8px',
                      }}
                    >
                      {types.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div style={{ marginTop: 8 }}>
                    <MarkdownEditor
                      value={draftBody}
                      onChange={setDraftBody}
                      ariaLabel="Contenido Markdown"
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      marginTop: 10,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => void handleSave()}
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setEditMode('preview')}
                    >
                      Cancelar
                    </button>
                    <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{saveState}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--ink-3)', marginLeft: 'auto' }}>
                      La vista previa se sanitiza (sin HTML crudo ni javascript:).
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  className="panel-pad"
                  style={{ lineHeight: 1.6, fontSize: 12.5, maxHeight: 520, overflow: 'auto' }}
                >
                  {viewVersion && (
                    <div style={{ marginBottom: 10 }}>
                      <span className="pill pill-accent">
                        Versión v{viewVersion} (solo lectura)
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        style={{ marginLeft: 8 }}
                        onClick={() => setViewVersion(null)}
                      >
                        Volver al estado actual
                      </button>
                    </div>
                  )}
                  {previewBody ? (
                    <div
                      className="doc-preview"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(previewBody) }}
                    />
                  ) : (
                    <EmptyState
                      title="Documento sin contenido"
                      description="Edítalo para añadir la especificación en Markdown."
                    />
                  )}
                </div>
              )}

              <div className="panel-pad" style={{ borderTop: '1px solid var(--line)' }}>
                <div className="panel-title">Historial de versiones</div>
                {versions.length === 0 ? (
                  <EmptyState
                    title="Sin versiones"
                    description="Las snapshots se crean al publicar o con «Crear versión»."
                  />
                ) : (
                  <ul className="timeline">
                    {versions.map((v) => (
                      <li key={v.id}>
                        <div className="t-time">
                          v{v.version} · {new Date(v.createdAt).toLocaleString('es-ES')}
                        </div>
                        <div className="t-text">
                          {v.changeNote ?? 'Sin nota'} — {v.title}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => setViewVersion(v.version)}
                          >
                            Ver
                          </button>
                          <label
                            style={{
                              display: 'inline-flex',
                              gap: 4,
                              alignItems: 'center',
                              fontSize: 11,
                            }}
                          >
                            <input
                              type="radio"
                              name="compare-from"
                              aria-label={`Comparar desde v${v.version}`}
                              checked={compareFrom === v.version}
                              onChange={() => setCompareFrom(v.version)}
                            />
                            desde v{v.version}
                          </label>
                          <label
                            style={{
                              display: 'inline-flex',
                              gap: 4,
                              alignItems: 'center',
                              fontSize: 11,
                            }}
                          >
                            <input
                              type="radio"
                              name="compare-to"
                              aria-label={`Comparar hasta v${v.version}`}
                              checked={compareTo === v.version}
                              onChange={() => setCompareTo(v.version)}
                            />
                            hasta v{v.version}
                          </label>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {compareParts && (
                  <div
                    style={{
                      marginTop: 8,
                      border: '1px solid var(--line)',
                      borderRadius: 8,
                      padding: 10,
                      background: '#fff',
                    }}
                  >
                    <strong style={{ fontSize: 12 }}>
                      Diff v{compareParts.from.version} → v{compareParts.to.version}
                    </strong>
                    <span style={{ fontSize: 10.5, color: 'var(--ink-3)', marginLeft: 8 }}>
                      +{compareParts.stats.added} / −{compareParts.stats.removed} líneas
                    </span>
                    <pre
                      className="mono"
                      style={{
                        marginTop: 8,
                        fontSize: 11,
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {compareParts.parts.map((part, i) => (
                        <span
                          key={i}
                          style={{
                            display: 'block',
                            background: part.added
                              ? 'var(--ok-soft)'
                              : part.removed
                                ? 'var(--crit-soft)'
                                : 'transparent',
                            color: part.added ? '#166534' : part.removed ? '#991b1b' : 'inherit',
                          }}
                        >
                          {part.added ? '+' : part.removed ? '−' : ' '}
                          {part.value}
                        </span>
                      ))}
                    </pre>
                  </div>
                )}

                <div className="panel-title" style={{ marginTop: 14 }}>
                  Nodos vinculados <span className="count">{selected.nodeCodes.length}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {selected.nodeCodes.map((code) => (
                    <span key={code} className="pill pill-accent">
                      {code}
                      {canWrite && (
                        <button
                          type="button"
                          aria-label={`Desvincular ${code}`}
                          style={{
                            marginLeft: 6,
                            border: 0,
                            background: 'transparent',
                            cursor: 'pointer',
                          }}
                          onClick={() =>
                            void run(async () => {
                              await api(
                                `${base}/${selected.id}/nodes/${encodeURIComponent(code)}`,
                                { method: 'DELETE' },
                              );
                              await refreshDocs();
                              void refreshSub(selected.id);
                            }, `Desvinculado de ${code}.`)
                          }
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                  {canWrite && (
                    <>
                      <select
                        value={linkNodeCode}
                        onChange={(e) => setLinkNodeCode(e.target.value)}
                        aria-label="Nodo a vincular"
                        style={{
                          border: '1px solid var(--line-strong)',
                          borderRadius: 7,
                          padding: '4px 6px',
                        }}
                      >
                        <option value="">Vincular nodo…</option>
                        {nodes.map((n) => (
                          <option key={n.id} value={n.code}>
                            {n.code} · {n.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={!linkNodeCode}
                        onClick={() =>
                          void run(async () => {
                            await api(`${base}/${selected.id}/nodes`, {
                              method: 'POST',
                              body: JSON.stringify({ nodeCode: linkNodeCode }),
                            });
                            await refreshDocs();
                            void refreshSub(selected.id);
                          }, 'Documento vinculado al nodo.')
                        }
                      >
                        Vincular
                      </button>
                    </>
                  )}
                </div>

                <div className="panel-title" style={{ marginTop: 14 }}>
                  Relaciones doc↔doc <span className="count">{relations.length}</span>
                </div>
                {relations.length === 0 ? (
                  <EmptyState
                    title="Sin relaciones"
                    description="Relaciona este documento con otros (p. ej. la especificación «especifica» un caso de uso)."
                  />
                ) : (
                  <div className="tbl-wrap">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th scope="col">Dirección</th>
                          <th scope="col">Tipo</th>
                          <th scope="col">Contraparte</th>
                          <th scope="col">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relations.map((rel) => {
                          const outgoing = rel.sourceId === selected.id;
                          const otherId = outgoing ? rel.targetId : rel.sourceId;
                          const other = docs.find((d) => d.id === otherId);
                          return (
                            <tr key={rel.id}>
                              <td>{outgoing ? 'Saliente' : 'Entrante'}</td>
                              <td className="mono">{rel.relationType}</td>
                              <td>
                                {other
                                  ? `${other.code ?? ''} ${other.title}`.trim()
                                  : otherId.slice(0, 8)}
                              </td>
                              <td>
                                {canWrite && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-danger-ghost"
                                    onClick={() =>
                                      void run(async () => {
                                        await api(`${base}/${selected.id}/relations/${rel.id}`, {
                                          method: 'DELETE',
                                        });
                                        void refreshSub(selected.id);
                                      }, 'Relación eliminada.')
                                    }
                                  >
                                    Eliminar
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {canWrite && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 6,
                      marginTop: 8,
                      flexWrap: 'wrap',
                      alignItems: 'center',
                    }}
                  >
                    <select
                      value={newRelationTarget}
                      onChange={(e) => setNewRelationTarget(e.target.value)}
                      aria-label="Documento destino"
                      style={{
                        border: '1px solid var(--line-strong)',
                        borderRadius: 7,
                        padding: '4px 6px',
                      }}
                    >
                      <option value="">Relacionar con…</option>
                      {docs
                        .filter((d) => d.id !== selected.id)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.code ?? d.title}
                          </option>
                        ))}
                    </select>
                    <select
                      value={newRelationType}
                      onChange={(e) => setNewRelationType(e.target.value)}
                      aria-label="Tipo de relación"
                      style={{
                        border: '1px solid var(--line-strong)',
                        borderRadius: 7,
                        padding: '4px 6px',
                      }}
                    >
                      {[
                        'specifies',
                        'references',
                        'relates_to',
                        'depends_on',
                        'applies_rule',
                        'documents',
                      ].map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={!newRelationTarget}
                      onClick={() =>
                        void run(async () => {
                          await api(`${base}/${selected.id}/relations`, {
                            method: 'POST',
                            body: JSON.stringify({
                              targetId: newRelationTarget,
                              relationType: newRelationType,
                            }),
                          });
                          setNewRelationTarget('');
                          void refreshSub(selected.id);
                        }, 'Relación creada.')
                      }
                    >
                      Crear relación
                    </button>
                  </div>
                )}

                <div className="panel-title" style={{ marginTop: 14 }}>
                  Adjuntos <span className="count">{attachments.length}</span>
                </div>
                {attachments.length === 0 ? (
                  <EmptyState
                    title="Sin adjuntos"
                    description="Diagramas, PDFs y archivos de evidencia. Se sirven siempre como descarga (attachment)."
                  />
                ) : (
                  <ul
                    style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}
                  >
                    {attachments.map((a) => (
                      <li
                        key={a.id}
                        style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}
                      >
                        <span className="mono" style={{ fontSize: 11 }}>
                          {a.filename}
                        </span>
                        <span style={{ color: 'var(--ink-3)', fontSize: 10.5 }}>
                          {Math.round(a.sizeBytes / 1024)} KB · {a.mimeType}
                        </span>
                        <a
                          className="btn btn-sm btn-ghost"
                          href={`/api/v1/products/${slug}/attachments/${a.id}/download`}
                          download={a.filename}
                          style={{ marginLeft: 'auto', textDecoration: 'none' }}
                        >
                          Descargar
                        </a>
                        {canWrite && (
                          <button
                            type="button"
                            className="btn btn-sm btn-danger-ghost"
                            onClick={() =>
                              void run(async () => {
                                await api(`/api/v1/products/${slug}/attachments/${a.id}`, {
                                  method: 'DELETE',
                                });
                                void refreshSub(selected.id);
                              }, 'Adjunto eliminado.')
                            }
                          >
                            Eliminar
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {canWrite && (
                  <form
                    style={{
                      marginTop: 8,
                      display: 'flex',
                      gap: 6,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const input = e.currentTarget.elements.namedItem(
                        'file',
                      ) as HTMLInputElement | null;
                      const file = input?.files?.[0];
                      if (!file) return;
                      void run(async () => {
                        const form = new FormData();
                        form.append('file', file);
                        const res = await fetch(
                          `/api/v1/products/${slug}/attachments?ownerId=${encodeURIComponent(selected.id)}`,
                          {
                            method: 'POST',
                            body: form,
                            credentials: 'same-origin',
                          },
                        );
                        if (!res.ok) {
                          const text = await res.text().catch(() => '');
                          throw new Error(`${res.status}: ${text.slice(0, 200)}`);
                        }
                        void refreshSub(selected.id);
                      }, 'Adjunto subido.');
                    }}
                  >
                    <input
                      type="file"
                      name="file"
                      aria-label="Archivo adjunto"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf,text/plain,text/markdown,text/csv,application/json"
                    />
                    <button type="submit" className="btn btn-sm">
                      Subir adjunto
                    </button>
                    <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
                      Máx. 15 MB · MIME allowlist · SVG sanitizado
                    </span>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="panel-pad">
              <EmptyState
                title="Selecciona un documento"
                description="Elige cualquier documento a la izquierda para ver su vista previa, versiones, vínculos y adjuntos."
              />
            </div>
          )}
        </div>
      </div>

      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Nuevo documento"
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
              <strong>Nuevo documento</strong>
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
                Tipo documental
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
                  {types.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
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
                Código (opcional, p. ej. DOC-101)
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="DOC-101"
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
                Nodo inicial (opcional)
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
                  <option value="">Sin nodo (global)</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.code}>
                      {n.code} · {n.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 11, fontWeight: 600 }}>
                Contenido Markdown
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  rows={6}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    border: '1px solid var(--line-strong)',
                    borderRadius: 7,
                    padding: '6px 8px',
                    fontFamily: 'var(--mono)',
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
                  Crear documento
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
