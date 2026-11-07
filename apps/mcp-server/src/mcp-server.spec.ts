/**
 * Tests unitarios del servidor MCP (F6b-T02/T03).
 * Sin API en vivo: la red se mockea con `fetch` stub.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseArgs } from './config';
import {
  DevcycleApiClient,
  McpApiError,
  TOOL_OUTPUT_MAX_BYTES,
  buildQuery,
  parseProblem,
  toToolResult,
  truncateJson,
} from './api-client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseArgs', () => {
  it('--token/--product/--api-base', () => {
    const { config } = parseArgs([
      '--token',
      'dvc_abc',
      '--product',
      'kanora',
      '--api-base',
      'http://localhost:3001/api/v1/',
    ]);
    expect(config).toMatchObject({ token: 'dvc_abc', productSlug: 'kanora' });
    expect(config?.apiBase).toBe('http://localhost:3001/api/v1');
  });

  it('acepta forma --k=v y envs', () => {
    process.env['DEVCYCLE_TOKEN'] = 'dvc_env';
    process.env['DEVCYCLE_PRODUCT'] = 'kanora';
    const { config } = parseArgs([]);
    expect(config?.token).toBe('dvc_env');
    expect(config?.productSlug).toBe('kanora');
    delete process.env['DEVCYCLE_TOKEN'];
    delete process.env['DEVCYCLE_PRODUCT'];
  });

  it('sin token → error legible', () => {
    delete process.env['DEVCYCLE_TOKEN'];
    expect(() => parseArgs([])).toThrow(/Falta el token/);
    expect(() => parseArgs(['--token', 'nope'])).toThrow(/dvc_/);
    expect(() => parseArgs(['--token', 'dvc_x', '--product', 'Kanora'])).toThrow(/Slug/);
  });

  it('--help no exige token', () => {
    const { help, config } = parseArgs(['--help']);
    expect(help).toBe(true);
    expect(config).toBeNull();
  });
});

describe('buildQuery / truncateJson / toToolResult', () => {
  it('buildQuery elimina undefined/null/vacío', () => {
    expect(buildQuery({ a: 'x', b: undefined, c: '', d: null as unknown as string })).toEqual({
      a: 'x',
    });
  });

  it('truncateJson respeta el presupuesto de 32 KB', () => {
    const small = truncateJson({ ok: true });
    expect(small.truncated).toBe(false);
    expect(small.text).toContain('"ok": true');

    const big = truncateJson({ blob: 'x'.repeat(TOOL_OUTPUT_MAX_BYTES + 1000) });
    expect(big.truncated).toBe(true);
    expect(Buffer.byteLength(big.text, 'utf8')).toBeLessThanOrEqual(TOOL_OUTPUT_MAX_BYTES + 100);
    expect(big.text).toContain('truncada a 32 KB');
  });

  it('toToolResult: structuredContent solo si no trunca', () => {
    const small = toToolResult({ target: { code: 'PANT-02' } });
    expect(small.structuredContent).toMatchObject({ target: { code: 'PANT-02' } });
    expect(small.content[0]?.text).toContain('PANT-02');

    const big = toToolResult({ items: [{ blob: 'x'.repeat(40_000) }] });
    expect(big.structuredContent).toBeUndefined();
    expect(big.content[0]?.text).toContain('truncada a 32 KB');
  });
});

describe('parseProblem', () => {
  it('mapea HTTP → MCP (401/403/404/409)', () => {
    expect(parseProblem(401, { code: 'auth.required', detail: 'falta token' }).mcpCode).toBe(
      'Unauthorized',
    );
    expect(parseProblem(403, { detail: 'tenant' }).mcpCode).toBe('Forbidden');
    expect(parseProblem(404, { detail: 'Nodo PANT-99 no existe' }).mcpCode).toBe('NotFound');
    expect(parseProblem(409, { detail: 'conflicto' }).mcpCode).toBe('Conflict');
    expect(parseProblem(400, { detail: 'bad' }).mcpCode).toBe('InvalidParams');
    expect(parseProblem(500, null).mcpCode).toBe('Internal');
  });
});

describe('DevcycleApiClient', () => {
  it('envía Bearer y devuelve JSON', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ target: { code: 'PANT-02' } }, { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = new DevcycleApiClient('http://api.test/api/v1', 'dvc_secreto');
    const data = await client.get<{ target: { code: string } }>(
      '/integration/products/kanora/nodes/PANT-02',
    );
    expect(data.target.code).toBe('PANT-02');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toContain('/integration/products/kanora/nodes/PANT-02');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer dvc_secreto');
  });

  it('403 → McpApiError Forbidden sin filtrar el token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { code: 'auth.forbidden', detail: 'El token no tiene acceso' },
          { status: 403 },
        ),
      ),
    );
    const client = new DevcycleApiClient('http://api.test/api/v1', 'dvc_secreto');
    await expect(client.get('/integration/products/nope')).rejects.toMatchObject({
      name: 'McpApiError',
      mcpCode: 'Forbidden',
      httpStatus: 403,
    });
  });

  it('error de red → Internal sin filtrar el token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );
    const client = new DevcycleApiClient('http://api.test/api/v1', 'dvc_secreto');
    await expect(client.get('/integration/products')).rejects.toMatchObject({
      mcpCode: 'Internal',
    });
    const caught = (await client.get('/integration/products').catch((e: unknown) => e)) as Error;
    expect(caught.message).not.toContain('dvc_secreto');
    expect(caught).toBeInstanceOf(McpApiError);
  });
});
