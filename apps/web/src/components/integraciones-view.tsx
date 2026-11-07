'use client';

import { useState } from 'react';
import { EmptyState } from '@devcycle/ui';
import type { AgentExecution, ApiTokenInfo, CreatedApiToken, ServiceAccount } from '@/lib/types';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', ...init });
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

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (diff < 0) {
    const mins = Math.floor(-diff / 60_000);
    if (mins < 60) return `en ${Math.max(1, mins)} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `en ${hours} h`;
    const days = Math.floor(hours / 24);
    return `en ${days} días`;
  }
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}

export function IntegracionesView({
  slug,
  productName,
  initialAccounts,
  initialExecutions,
}: {
  slug: string;
  productName: string;
  initialAccounts: ServiceAccount[];
  initialExecutions: AgentExecution[];
}) {
  const [accounts, setAccounts] = useState<ServiceAccount[]>(initialAccounts);
  const [executions, setExecutions] = useState<AgentExecution[]>(initialExecutions);
  const [tokensByAccount, setTokensByAccount] = useState<Record<string, ApiTokenInfo[]>>({});
  const [newAccountName, setNewAccountName] = useState('claude-code');
  const [newAccountKind, setNewAccountKind] = useState('claude-code');
  const [createdToken, setCreatedToken] = useState<CreatedApiToken | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string>(initialAccounts[0]?.id ?? '');

  const refreshTokens = async (accountId: string) => {
    try {
      const tokens = await api<ApiTokenInfo[]>(
        `/api/v1/products/${slug}/integration/service-accounts/${accountId}/tokens`,
      );
      setTokensByAccount((prev) => ({ ...prev, [accountId]: tokens }));
    } catch {
      // best-effort: la lista de tokens se carga al seleccionar
    }
  };

  const refreshExecutions = async () => {
    try {
      const rows = await api<AgentExecution[]>(`/api/v1/products/${slug}/integration/executions`);
      setExecutions(rows);
    } catch {
      // best-effort
    }
  };

  const handleCreateAccount = async () => {
    setError(null);
    setBusy(true);
    try {
      const account = await api<ServiceAccount>(
        `/api/v1/products/${slug}/integration/service-accounts`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: newAccountName, agentKind: newAccountKind }),
        },
      );
      setAccounts((prev) => [...prev, account]);
      setSelectedAccount(account.id);
      await refreshTokens(account.id);
      await refreshExecutions();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCreateToken = async () => {
    if (!selectedAccount) {
      setError('Selecciona una cuenta de servicio primero');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const token = await api<CreatedApiToken>(`/api/v1/products/${slug}/integration/tokens`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          serviceAccountId: selectedAccount,
          scopes: [],
          expiresInDays: 30,
          label: 'read-only (F6a)',
        }),
      });
      setCreatedToken(token);
      setCopied(false);
      await refreshTokens(selectedAccount);
      await refreshExecutions();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (tokenId: string) => {
    setError(null);
    setBusy(true);
    try {
      await api(`/api/v1/products/${slug}/integration/tokens/${tokenId}/revoke`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      await refreshTokens(selectedAccount);
      await refreshExecutions();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSelectAccount = async (accountId: string) => {
    setSelectedAccount(accountId);
    await refreshTokens(accountId);
  };

  const currentTokens = tokensByAccount[selectedAccount] ?? [];

  return (
    <>
      <div className="view-head">
        <div>
          <h1>Integraciones y agentes</h1>
          <p className="sub">
            API read-only para agentes (Fase 6a) + servidor MCP stdio (Fase 6b) · Tokens por
            producto con scopes · <strong>{productName}</strong>
          </p>
        </div>
        <div className="spacer" />
        <a className="btn btn-sm" href="/api/v1/docs/integration" target="_blank" rel="noreferrer">
          OpenAPI integration-v1
        </a>
      </div>

      {error ? (
        <p role="alert" className="error-banner">
          {error}
        </p>
      ) : null}

      <section className="panel">
        <h2>Cuentas de servicio y tokens</h2>
        <p className="sub">
          El token en claro se muestra <strong>una sola vez</strong> al crearlo (patrón GitHub).
          Guárdalo para el servidor MCP (solo lectura, stdio):
        </p>
        <code style={{ wordBreak: 'break-all' }}>
          claude mcp add --scope project devcycle -- devcycle-mcp --token dvc_… --product {slug}
        </code>
        <p className="sub">
          Sin Claude Code: <code>devcycle-mcp --token dvc_… --product {slug}</code> (o variables{' '}
          <code>DEVCYCLE_TOKEN</code> / <code>DEVCYCLE_PRODUCT</code>). Guía en{' '}
          <code>docs/agentes/conectar-claude-code.md</code>
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
          <label>
            <span className="label">Nombre (minúsculas, dígitos y guiones)</span>
            <input
              className="input"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder="claude-code"
            />
          </label>
          <label>
            <span className="label">Tipo de agente</span>
            <input
              className="input"
              value={newAccountKind}
              onChange={(e) => setNewAccountKind(e.target.value)}
              placeholder="claude-code"
            />
          </label>
          <button
            type="button"
            className="btn btn-sm"
            disabled={busy}
            onClick={handleCreateAccount}
          >
            Crear cuenta
          </button>
        </div>

        <div
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end', marginTop: 12 }}
        >
          <label>
            <span className="label">Cuenta para el token</span>
            <select
              className="input"
              value={selectedAccount}
              onChange={(e) => void handleSelectAccount(e.target.value)}
            >
              <option value="">— selecciona —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.agentKind})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-sm"
            disabled={busy || !selectedAccount}
            onClick={handleCreateToken}
          >
            Crear token read-only (30 días)
          </button>
        </div>

        {createdToken ? (
          <div className="panel" role="status" style={{ marginTop: 12 }}>
            <strong>Copia este token ahora — no se volverá a mostrar:</strong>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <code style={{ wordBreak: 'break-all' }}>{createdToken.token}</code>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  void navigator.clipboard.writeText(createdToken.token);
                  setCopied(true);
                }}
              >
                {copied ? '¡Copiado!' : 'Copiar'}
              </button>
            </div>
            <p className="sub">
              Prefijo <code>{createdToken.tokenPrefix}</code> · scopes{' '}
              <code>{createdToken.scopes.join(', ') || 'read:* (defecto)'}</code> · expira{' '}
              {relativeTime(createdToken.expiresAt)}
            </p>
          </div>
        ) : null}

        {accounts.length === 0 ? (
          <EmptyState
            title="Sin cuentas de servicio"
            description="Crea una cuenta (p. ej. claude-code) para generar su primer token read-only."
          />
        ) : (
          <>
            <h3>Tokens de la cuenta seleccionada</h3>
            {currentTokens.length === 0 ? (
              <p className="sub">Sin tokens cargados — selecciona la cuenta o crea uno.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Prefijo</th>
                    <th>Etiqueta</th>
                    <th>Scopes</th>
                    <th>Último uso</th>
                    <th>Expira</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {currentTokens.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <code>{t.tokenPrefix}…</code>
                      </td>
                      <td>{t.label ?? '—'}</td>
                      <td>{(t.scopes ?? []).join(', ') || 'read:*'}</td>
                      <td>{relativeTime(t.lastUsedAt)}</td>
                      <td>{relativeTime(t.expiresAt)}</td>
                      <td>{t.revokedAt ? 'Revocado' : 'Activo'}</td>
                      <td>
                        {!t.revokedAt ? (
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={busy}
                            onClick={() => void handleRevoke(t.id)}
                          >
                            Revocar
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>

      <section className="panel">
        <h2>Auditoría de agentes</h2>
        <p className="sub">
          Cada llamada <code>/integration/*</code> queda en <code>agent_executions</code> y en{' '}
          <code>activity_log</code> con badge AGENTE IA. Sin secretos en los argumentos.
        </p>
        {executions.length === 0 ? (
          <EmptyState
            title="Sin ejecuciones todavía"
            description="Conecta un agente con un token y consulta el contexto de una pantalla."
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Agente</th>
                <th>Herramienta</th>
                <th>Estado</th>
                <th>Resumen</th>
                <th>Duración</th>
                <th>Cuándo</th>
              </tr>
            </thead>
            <tbody>
              {executions.slice(0, 20).map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.agentName ?? '—'} <span className="pill pill-neutral">AGENTE IA</span>
                  </td>
                  <td>{e.toolName ?? '—'}</td>
                  <td>{e.status}</td>
                  <td>{e.requestSummary?.slice(0, 120) || '—'}</td>
                  <td>{e.durationMs != null ? `${e.durationMs} ms` : '—'}</td>
                  <td>{relativeTime(e.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
