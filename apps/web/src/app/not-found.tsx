import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="login-shell">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <div
          className="brand-mark"
          style={{ margin: '0 auto', width: 46, height: 46, fontSize: 19 }}
        >
          DC
        </div>
        <h1 style={{ fontSize: 19, marginTop: 12 }}>404 · No encontrado</h1>
        <p style={{ color: 'var(--ink-2)', fontSize: 12.5, marginTop: 6 }}>
          Este producto no existe o no tienes acceso a él.
        </p>
        <Link
          className="btn btn-primary"
          href="/products"
          style={{ marginTop: 14, display: 'inline-flex' }}
        >
          Volver a Productos
        </Link>
      </div>
    </main>
  );
}
