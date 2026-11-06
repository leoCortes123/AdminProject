'use client';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="panel panel-pad" role="alert" style={{ maxWidth: 560, margin: '40px auto' }}>
      <div className="panel-title">Algo se ha roto</div>
      <p style={{ fontSize: 13, lineHeight: 1.6 }}>
        No se pudo cargar esta vista. Si acabas de reiniciar el PC, comprueba que la API está en marcha
        (<code className="mono">localhost:3001/api/v1/health</code>).
      </p>
      {error.digest && <p className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>digest: {error.digest}</p>}
      <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={reset}>
        Reintentar
      </button>
    </div>
  );
}
