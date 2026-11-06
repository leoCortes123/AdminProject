'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { PRODUCT_STATUSES, type ProductStatus } from '@devcycle/shared';

const STATUS_LABEL: Record<ProductStatus, string> = {
  active: 'Activo',
  in_development: 'En desarrollo',
  maintenance: 'Mantenimiento',
  archived: 'Archivado',
};

interface Props {
  canManage: boolean;
}

/** Botón + modal de alta de producto (solo admin_global). */
export function NewProductButton({ canManage }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [tagline, setTagline] = useState('');
  const [status, setStatus] = useState<ProductStatus>('in_development');
  const [stack, setStack] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!canManage) {
    return null;
  }

  const reset = () => {
    setName('');
    setSlug('');
    setTagline('');
    setStatus('in_development');
    setStack('');
    setError(null);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/v1/products', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          ...(tagline.trim() ? { tagline: tagline.trim() } : {}),
          status,
          techStack: stack.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (response.status === 409) {
        setError(`Ya existe un producto con slug '${slug.trim()}'.`);
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        setError(body?.detail ?? 'No se pudo crear el producto.');
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      setError('No se pudo contactar con la API.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Nuevo producto
      </button>
      {open && (
        <div className="palette-backdrop open" role="dialog" aria-modal="true" aria-label="Nuevo producto">
          <form className="palette" style={{ width: 'min(480px, 92vw)' }} onSubmit={onSubmit}>
            <div style={{ padding: '14px 16px 0' }} className="panel-title">Nuevo producto</div>
            <div style={{ padding: '12px 16px 16px', display: 'grid', gap: 10 }}>
              <label className="login-field" style={{ margin: 0 }}>
                <span>Nombre</span>
                <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} placeholder="Kanora" autoFocus />
              </label>
              <label className="login-field" style={{ margin: 0 }}>
                <span>Slug</span>
                <input value={slug} onChange={(e) => setSlug(e.target.value)} required minLength={2} pattern="[a-z0-9][a-z0-9-]{1,62}" placeholder="kanora" />
              </label>
              <label className="login-field" style={{ margin: 0 }}>
                <span>Eslogan (opcional)</span>
                <input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={200} placeholder="ERP logístico para última milla" />
              </label>
              <label className="login-field" style={{ margin: 0 }}>
                <span>Estado</span>
                <select value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)} aria-label="Estado del producto" style={{ display: 'block', width: '100%', marginTop: 5, border: '1px solid var(--line-strong)', borderRadius: 8, padding: 9, fontFamily: 'inherit' }}>
                  {PRODUCT_STATUSES.map((value) => (
                    <option key={value} value={value}>{STATUS_LABEL[value]}</option>
                  ))}
                </select>
              </label>
              <label className="login-field" style={{ margin: 0 }}>
                <span>Stack (separado por comas)</span>
                <input value={stack} onChange={(e) => setStack(e.target.value)} placeholder="Next.js, NestJS, PostgreSQL" />
              </label>
              {error && <div role="alert" className="login-error" style={{ margin: 0 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => { setOpen(false); reset(); }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Creando…' : 'Crear producto'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
