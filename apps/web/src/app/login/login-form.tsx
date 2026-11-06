'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

type Mode = 'signin' | 'signup';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Si la sesión caducó, ?next conserva el destino.
  const next = searchParams.get('next') ?? '/products';

  useEffect(() => {
    setError(null);
  }, [mode]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result =
        mode === 'signin'
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ email, password, name: name.trim() });
      if (result.error) {
        setError(
          mode === 'signin'
            ? 'Credenciales no válidas. Revisa el email y la contraseña.'
            : (result.error.message ?? 'No se pudo crear la cuenta.'),
        );
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError('No se pudo contactar con el servidor. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-card">
      <div className="login-brand">
        <div className="brand-mark" style={{ width: 46, height: 46, fontSize: 19 }}>
          DC
        </div>
        <div>
          <h1 style={{ fontSize: 22, letterSpacing: '-0.4px' }}>DevCycle</h1>
          <p style={{ color: 'var(--ink-2)', fontSize: 12, marginTop: 2 }}>
            Ciclo de vida del software · multiproducto
          </p>
        </div>
      </div>

      <div className="login-tabs" role="tablist" aria-label="Entrar o crear cuenta">
        <button
          type="button"
          role="tab"
          id="tab-signin"
          aria-selected={mode === 'signin'}
          className={mode === 'signin' ? 'tab active' : 'tab'}
          onClick={() => setMode('signin')}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          role="tab"
          id="tab-signup"
          aria-selected={mode === 'signup'}
          className={mode === 'signup' ? 'tab active' : 'tab'}
          onClick={() => setMode('signup')}
        >
          Crear cuenta
        </button>
      </div>

      <form onSubmit={onSubmit} aria-labelledby={mode === 'signin' ? 'tab-signin' : 'tab-signup'}>
        {mode === 'signup' && (
          <label className="login-field">
            <span>Nombre completo</span>
            <input
              type="text"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={2}
              placeholder="Ada Lovelace"
            />
          </label>
        )}
        <label className="login-field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="tu@empresa.com"
          />
        </label>
        <label className="login-field">
          <span>Contraseña {mode === 'signup' && <small>(mín. 8 caracteres)</small>}</span>
          <input
            type="password"
            name="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={mode === 'signup' ? 8 : 1}
            placeholder="••••••••"
          />
        </label>

        {error && (
          <div role="alert" className="login-error">
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
          {loading ? 'Un momento…' : mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
        </button>
      </form>

      <p className="login-foot">
        El <strong>primer usuario registrado</strong> recibe el rol Administrador global. El resto
        entra a los productos por invitación de un administrador.
      </p>
    </div>
  );
}
