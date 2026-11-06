/**
 * FND-I / FND-SEC · Integración contra PostgreSQL real (devcycle_test, sembrada
 * desde cero en globalSetup). Ejercita el wiring EXACTO de producción
 * (helmet → better-auth → guards → problem+json) vía Supertest.
 */
import './test-env';
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createNestApp } from '../bootstrap';

let app: NestExpressApplication;

beforeAll(async () => {
  app = await createNestApp();
  await app.init();
}, 120_000);

/** PRNG determinista (mulberry32) — fuzz reproducible sin dependencias extra. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface TestNode {
  id: string;
  code: string;
  name: string;
  path: string;
  depth: number;
  parentId: string | null;
  position: number;
  status: string;
  nodeType: { key: string };
}

const ltreeLabel = (code: string) => code.toLowerCase().replace(/-/g, '_');

async function fetchNodes(agent: request.Agent, slug: string): Promise<TestNode[]> {
  const res = await agent.get(`/api/v1/products/${slug}/nodes`);
  expect(res.status).toBe(200);
  return res.body as TestNode[];
}

async function assertTreeInvariants(agent: request.Agent, slug: string): Promise<void> {
  const nodes = await fetchNodes(agent, slug);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  for (const n of nodes) {
    expect(seen.has(n.path), `path duplicado ${n.path}`).toBe(false);
    seen.add(n.path);
    const expected = n.parentId
      ? `${byId.get(n.parentId)!.path}.${ltreeLabel(n.code)}`
      : ltreeLabel(n.code);
    expect(n.path, `path inconsistente para ${n.code}`).toBe(expected);
    expect(n.depth).toBe(n.path.split('.').length - 1);
    if (n.parentId) {
      const parent = byId.get(n.parentId);
      expect(parent, `padre huérfano de ${n.code}`).toBeDefined();
      expect(parent!.depth).toBeLessThan(n.depth);
    }
  }
}

describe('DevCycle API (integración · PG efímero)', () => {
  const adminAgent = request.agent(() => app.getHttpServer());
  const outsiderAgent = request.agent(() => app.getHttpServer());

  it('GET /api/v1/health → { status: ok, db: up }', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'up' });
  });

  it('GET /api/v1/products sin sesión → 401 problem+json', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/products');
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.code).toBe('auth.required');
  });

  it('la BD efímera nace con el seed demo (kanora, verdana, nucleo)', async () => {
    const signup = await adminAgent
      .post('/api/auth/sign-up/email')
      .send({ name: 'Admin Itest', email: 'admin@itest.dev', password: 'itest-password-123' });
    expect(signup.status).toBe(200);

    const me = await adminAgent.get('/api/v1/me');
    expect(me.body.globalRoles).toContain('admin_global');

    const products = await adminAgent.get('/api/v1/products');
    const slugs = products.body.items.map((p: { slug: string }) => p.slug);
    expect(slugs).toEqual(expect.arrayContaining(['kanora', 'verdana', 'nucleo']));
  });

  it('crear dos productos aislados (α/β) con workflow por defecto', async () => {
    for (const slug of ['itest-alpha', 'itest-beta']) {
      const res = await adminAgent
        .post('/api/v1/products')
        .send({ name: `Itest ${slug}`, slug, techStack: ['NestJS'] });
      expect(res.status).toBe(201);
      expect(res.body.slug).toBe(slug);
    }
    const alpha = await adminAgent.get('/api/v1/products/itest-alpha/nodes');
    expect(alpha.status).toBe(200);
    expect(alpha.body).toHaveLength(0);
  });

  it('CRUD + move + duplicate + deactivate en α mantiene el árbol íntegro', async () => {
    // Crear MOD → PANT → COMP (anidados)
    const mod = await adminAgent
      .post('/api/v1/products/itest-alpha/nodes')
      .send({ parentId: null, nodeTypeKey: 'modulo', code: 'MOD-T1', name: 'Módulo Itest' });
    expect(mod.status).toBe(201);
    const pant = await adminAgent
      .post('/api/v1/products/itest-alpha/nodes')
      .send({
        parentId: mod.body.id,
        nodeTypeKey: 'pantalla',
        code: 'PANT-T11',
        name: 'Pantalla Itest',
      });
    expect(pant.status).toBe(201);
    const comp = await adminAgent
      .post('/api/v1/products/itest-alpha/nodes')
      .send({
        parentId: pant.body.id,
        nodeTypeKey: 'componente',
        code: 'COMP-T11',
        name: 'Componente Itest',
      });
    expect(comp.status).toBe(201);

    // Código duplicado → 409 node.code_conflict
    const dup = await adminAgent
      .post('/api/v1/products/itest-alpha/nodes')
      .send({ parentId: null, nodeTypeKey: 'modulo', code: 'MOD-T1', name: 'Otra vez' });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('node.code_conflict');

    // Mover COMP-T11 a la raíz (posiciona y recomputa path)
    const move = await adminAgent
      .post('/api/v1/products/itest-alpha/nodes/COMP-T11/move')
      .send({ newParentId: null });
    expect(move.status).toBe(200);
    expect(move.body.path).toBe('comp_t11');

    // Anti-ciclo: mover el módulo dentro de su propio hijo
    const cycle = await adminAgent
      .post('/api/v1/products/itest-alpha/nodes/MOD-T1/move')
      .send({ newParentId: comp.body.id });
    expect(cycle.status).toBe(422);
    expect(cycle.body.code).toBe('node.move_into_descendant');

    // Duplicar el módulo (raíz junto a sí mismo) → códigos nuevos
    const copy = await adminAgent.post('/api/v1/products/itest-alpha/nodes/MOD-T1/duplicate');
    expect(copy.status).toBe(201);
    expect(copy.body.nodes).toEqual(['MOD-T2', 'PANT-T12']);

    await assertTreeInvariants(adminAgent, 'itest-alpha');

    // Desactivar el duplicado (subárbol completo) → fuera del listado
    const off = await adminAgent.post('/api/v1/products/itest-alpha/nodes/MOD-T2/deactivate');
    expect(off.status).toBe(200);
    expect(off.body.deactivated).toBe(2);

    const remaining = await fetchNodes(adminAgent, 'itest-alpha');
    expect(remaining.map((n) => n.code)).not.toContain('MOD-T2');
    await assertTreeInvariants(adminAgent, 'itest-alpha');
  });

  it('FND-SEC · tenant-escape v1: sin membresía → 403; como viewer → leer sí, escribir no', async () => {
    const signup = await outsiderAgent
      .post('/api/auth/sign-up/email')
      .send({
        name: 'Outsider Itest',
        email: 'outsider@itest.dev',
        password: 'itest-password-123',
      });
    expect(signup.status).toBe(200);

    // Producto α ajeno: 403 en todo
    const denied = await outsiderAgent.get('/api/v1/products/itest-alpha/nodes');
    expect(denied.status).toBe(403);

    // Añadir al outsider como viewer de α (el admin tiene members:manage)
    const invite = await adminAgent
      .post('/api/v1/products/itest-alpha/members')
      .send({ email: 'outsider@itest.dev', roleKey: 'viewer' });
    expect(invite.status).toBe(201);

    // Leer sí; escribir no (403)
    const read = await outsiderAgent.get('/api/v1/products/itest-alpha/nodes');
    expect(read.status).toBe(200);
    const write = await outsiderAgent
      .post('/api/v1/products/itest-alpha/nodes')
      .send({ parentId: null, nodeTypeKey: 'modulo', code: 'MOD-HACK', name: 'Nope' });
    expect(write.status).toBe(403);
    const patch = await outsiderAgent
      .patch('/api/v1/products/itest-alpha')
      .send({ name: 'Hackeado' });
    expect(patch.status).toBe(403);

    // β sigue ajeno por completo para el outsider
    const betaDenied = await outsiderAgent.get('/api/v1/products/itest-beta/nodes');
    expect(betaDenied.status).toBe(403);
  });

  it('fuzz de 300 movimientos aleatorios — árbol siempre conexo, sin ciclos, paths consistentes', async () => {
    const rng = mulberry32(20261106);
    const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]!;

    await adminAgent
      .post('/api/v1/products')
      .send({ name: 'Itest Fuzz', slug: 'itest-fuzz', techStack: ['NestJS'] });

    const rootCodes = Array.from({ length: 6 }, (_, i) => `FUZZ-${String(i + 1).padStart(2, '0')}`);
    for (const code of rootCodes) {
      const res = await adminAgent
        .post('/api/v1/products/itest-fuzz/nodes')
        .send({ parentId: null, nodeTypeKey: 'pantalla', code, name: `Nodo ${code}` });
      expect(res.status).toBe(201);
    }

    for (let i = 0; i < 300; i++) {
      const nodes = await fetchNodes(adminAgent, 'itest-fuzz');
      const node = pick(nodes);
      const candidates = [null, ...nodes.filter((n) => n.id !== node.id).map((n) => n.id)];
      const res = await adminAgent
        .post(`/api/v1/products/itest-fuzz/nodes/${node.code}/move`)
        .send({ newParentId: pick(candidates) });
      expect([200, 422]).toContain(res.status);
      if (i % 25 === 24) {
        await assertTreeInvariants(adminAgent, 'itest-fuzz');
      }
    }
    await assertTreeInvariants(adminAgent, 'itest-fuzz');
  }, 170_000);
});
