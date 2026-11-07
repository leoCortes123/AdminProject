/**
 * FND-I / FND-SEC · Integración contra PostgreSQL real (devcycle_test, sembrada
 * desde cero en globalSetup). Ejercita el wiring EXACTO de producción
 * (helmet → better-auth → guards → problem+json) vía Supertest.
 */
import './test-env';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createNestApp } from '../bootstrap';

let app: NestExpressApplication;
let adminAgent: request.Agent;
let outsiderAgent: request.Agent;

beforeAll(async () => {
  app = await createNestApp();
  await app.init();
  // supertest: pasar el SERVIDOR HTTP, no un factory — una función se
  // interpreta como request listener y cuelga cada petición para siempre.
  adminAgent = request.agent(app.getHttpServer());
  outsiderAgent = request.agent(app.getHttpServer());
}, 120_000);

afterAll(async () => {
  await app?.close();
});

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
      .send({ parentId: null, nodeTypeKey: 'modulo', code: 'MOD-1', name: 'Módulo Itest' });
    expect(mod.status).toBe(201);
    const pant = await adminAgent.post('/api/v1/products/itest-alpha/nodes').send({
      parentId: mod.body.id,
      nodeTypeKey: 'pantalla',
      code: 'PANT-11',
      name: 'Pantalla Itest',
    });
    expect(pant.status).toBe(201);
    const comp = await adminAgent.post('/api/v1/products/itest-alpha/nodes').send({
      parentId: pant.body.id,
      nodeTypeKey: 'componente',
      code: 'COMP-11',
      name: 'Componente Itest',
    });
    expect(comp.status).toBe(201);

    // Código duplicado → 409 node.code_conflict
    const dup = await adminAgent
      .post('/api/v1/products/itest-alpha/nodes')
      .send({ parentId: null, nodeTypeKey: 'modulo', code: 'MOD-1', name: 'Otra vez' });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('node.code_conflict');

    // Mover COMP-11 a la raíz (posiciona y recomputa path)
    const move = await adminAgent
      .post('/api/v1/products/itest-alpha/nodes/COMP-11/move')
      .send({ newParentId: null });
    expect(move.status).toBe(200);
    expect(move.body.path).toBe('comp_11');

    // Anti-ciclo: mover el módulo dentro de su propio hijo (PANT-11 sigue
    // siendo hijo de MOD-1; COMP-11 ya no — se movió a la raíz antes).
    const cycle = await adminAgent
      .post('/api/v1/products/itest-alpha/nodes/MOD-1/move')
      .send({ newParentId: pant.body.id });
    expect(cycle.status).toBe(422);
    expect(cycle.body.code).toBe('node.move_into_descendant');

    // Duplicar el módulo (raíz junto a sí mismo) → códigos nuevos
    const copy = await adminAgent.post('/api/v1/products/itest-alpha/nodes/MOD-1/duplicate');
    expect(copy.status).toBe(201);
    expect(copy.body.nodes).toEqual(['MOD-02', 'PANT-12']);

    await assertTreeInvariants(adminAgent, 'itest-alpha');

    // Desactivar el duplicado (subárbol completo) → fuera del listado
    const off = await adminAgent.post('/api/v1/products/itest-alpha/nodes/MOD-02/deactivate');
    expect(off.status).toBe(200);
    expect(off.body.deactivated).toBe(2);

    const remaining = await fetchNodes(adminAgent, 'itest-alpha');
    expect(remaining.map((n) => n.code)).not.toContain('MOD-02');
    await assertTreeInvariants(adminAgent, 'itest-alpha');
  });

  it('FND-SEC · tenant-escape v1: sin membresía → 403; como viewer → leer sí, escribir no', async () => {
    const signup = await outsiderAgent.post('/api/auth/sign-up/email').send({
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

  it('fuzz de 1.000 movimientos aleatorios — árbol siempre conexo, sin ciclos, paths consistentes', async () => {
    // Presupuesto del plan (07 §2 / 08 §2): 1.000 movimientos por ejecución.
    // Ambas cifras son sobreescribibles para poder correr una pasada corta en
    // local (`MOVE_FUZZ_OPS=100 pnpm test:integration`) sin cambiar la semántica.
    const totalOps = Number(process.env.MOVE_FUZZ_OPS ?? 1000);
    const checkEvery = Number(process.env.MOVE_FUZZ_CHECK_EVERY ?? 25);
    expect(Number.isInteger(totalOps) && totalOps > 0).toBe(true);

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

    for (let i = 0; i < totalOps; i++) {
      const nodes = await fetchNodes(adminAgent, 'itest-fuzz');
      const node = pick(nodes);
      const candidates = [null, ...nodes.filter((n) => n.id !== node.id).map((n) => n.id)];
      const res = await adminAgent
        .post(`/api/v1/products/itest-fuzz/nodes/${node.code}/move`)
        .send({ newParentId: pick(candidates) });
      expect([200, 422]).toContain(res.status);
      if (i % checkEvery === checkEvery - 1) {
        await assertTreeInvariants(adminAgent, 'itest-fuzz');
      }
    }
    await assertTreeInvariants(adminAgent, 'itest-fuzz');
  }, 900_000);
});

describe('DevCycle Documentación F2 (integración · PG efímero)', () => {
  let collaboratorAgent: request.Agent;
  let docId: string;
  let doc2Id: string;
  const nodeCode = 'PANT-51';
  const PNG_MINIMAL = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

  beforeAll(async () => {
    collaboratorAgent = request.agent(app.getHttpServer());
    const signupCollab = await collaboratorAgent.post('/api/auth/sign-up/email').send({
      name: 'Collab Docs',
      email: 'docs-collab@itest.dev',
      password: 'itest-password-123',
    });
    expect(signupCollab.status).toBe(200);

    for (const slug of ['itest-docs-alpha', 'itest-docs-beta']) {
      const res = await adminAgent
        .post('/api/v1/products')
        .send({ name: `Docs ${slug}`, slug, techStack: ['NestJS'] });
      expect(res.status).toBe(201);
    }
    const mod = await adminAgent
      .post('/api/v1/products/itest-docs-alpha/nodes')
      .send({ parentId: null, nodeTypeKey: 'modulo', code: 'MOD-51', name: 'Módulo docs' });
    expect(mod.status).toBe(201);
    const pant = await adminAgent.post('/api/v1/products/itest-docs-alpha/nodes').send({
      parentId: mod.body.id,
      nodeTypeKey: 'pantalla',
      code: nodeCode,
      name: 'Pantalla docs',
    });
    expect(pant.status).toBe(201);
  }, 120_000);

  it('catálogo: 13 tipos documentales (incluye adr)', async () => {
    const res = await adminAgent.get('/api/v1/products/itest-docs-alpha/documents/types');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(13);
    expect(res.body.map((t: { key: string }) => t.key)).toContain('adr');
  });

  it('CRUD: crear documento vinculado a nodo visible en ambos lados', async () => {
    const created = await adminAgent.post('/api/v1/products/itest-docs-alpha/documents').send({
      docTypeKey: 'spec',
      code: 'DOC-051',
      title: 'Especificación funcional — Asignación de pedidos',
      bodyMarkdown: '# Asignación\n\nConsolidar pedidos en rutas óptimas.',
      nodeCodes: [nodeCode],
    });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('draft');
    expect(created.body.version).toBe(1);
    expect(created.body.nodeCodes).toContain(nodeCode);
    docId = created.body.id;

    const dup = await adminAgent
      .post('/api/v1/products/itest-docs-alpha/documents')
      .send({ docTypeKey: 'use_case', code: 'DOC-051', title: 'Duplicado' });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('document.code_conflict');

    const list = await adminAgent.get('/api/v1/products/itest-docs-alpha/documents');
    expect(list.status).toBe(200);
    expect(list.body.map((d: { id: string }) => d.id)).toContain(docId);
    const byNode = await adminAgent.get(
      `/api/v1/products/itest-docs-alpha/nodes/${nodeCode}/documents`,
    );
    expect(byNode.status).toBe(200);
    expect(byNode.body.map((d: { id: string }) => d.id)).toContain(docId);

    const detail = await adminAgent.get(`/api/v1/products/itest-docs-alpha/documents/${docId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.title).toContain('Asignación');
  });

  it('transiciones: draft→published directo rechazado; draft→in_review ok', async () => {
    const bad = await adminAgent
      .post(`/api/v1/products/itest-docs-alpha/documents/${docId}/transition`)
      .send({ toStatus: 'published' });
    expect(bad.status).toBe(409);
    expect(bad.body.code).toBe('document.invalid_transition');

    const ok = await adminAgent
      .post(`/api/v1/products/itest-docs-alpha/documents/${docId}/transition`)
      .send({ toStatus: 'in_review' });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('in_review');
  });

  it('versionado: v1 inicial, createVersion v2, publish v3 con estado publicado', async () => {
    const versions0 = await adminAgent.get(
      `/api/v1/products/itest-docs-alpha/documents/${docId}/versions`,
    );
    expect(versions0.body).toHaveLength(1);

    const edited = await adminAgent
      .patch(`/api/v1/products/itest-docs-alpha/documents/${docId}`)
      .send({ bodyMarkdown: '# Asignación v2\n\nAñade criterios de aceptación.' });
    expect(edited.status).toBe(200);
    const versionsAfterEdit = await adminAgent.get(
      `/api/v1/products/itest-docs-alpha/documents/${docId}/versions`,
    );
    expect(versionsAfterEdit.body).toHaveLength(1);

    const v2 = await adminAgent
      .post(`/api/v1/products/itest-docs-alpha/documents/${docId}/versions`)
      .send({ changeNote: 'Borrador v2', expectedVersion: 1 });
    expect(v2.status).toBe(201);
    expect(v2.body.version).toBe(2);

    const stale = await adminAgent
      .post(`/api/v1/products/itest-docs-alpha/documents/${docId}/versions`)
      .send({ changeNote: 'Pisa v2', expectedVersion: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('document.version_conflict');

    const published = await adminAgent
      .post(`/api/v1/products/itest-docs-alpha/documents/${docId}/publish`)
      .send({ changeNote: 'Publicación vigente' });
    expect(published.status).toBe(200);
    expect(published.body.status).toBe('published');
    expect(published.body.version).toBe(3);

    const versions = await adminAgent.get(
      `/api/v1/products/itest-docs-alpha/documents/${docId}/versions`,
    );
    expect(versions.body.map((v: { version: number }) => v.version)).toEqual([3, 2, 1]);

    const v2detail = await adminAgent.get(
      `/api/v1/products/itest-docs-alpha/documents/${docId}/versions/2`,
    );
    expect(v2detail.status).toBe(200);
    expect(v2detail.body.bodyMarkdown).toContain('criterios de aceptación');
  });

  it('vínculos: nodo inexistente → 422; doc↔doc con duplicado 409 y auto-relación 422', async () => {
    const badNode = await adminAgent
      .post(`/api/v1/products/itest-docs-alpha/documents/${docId}/nodes`)
      .send({ nodeCode: 'NOPE-99' });
    expect(badNode.status).toBe(422);

    const second = await adminAgent.post('/api/v1/products/itest-docs-alpha/documents').send({
      docTypeKey: 'use_case',
      code: 'DOC-052',
      title: 'Caso de uso — Asignar pedido a ruta óptima',
      bodyMarkdown: 'Flujo principal y alternativos.',
    });
    expect(second.status).toBe(201);
    doc2Id = second.body.id;

    const rel = await adminAgent
      .post(`/api/v1/products/itest-docs-alpha/documents/${docId}/relations`)
      .send({ targetId: doc2Id, relationType: 'specifies' });
    expect(rel.status).toBe(201);

    const dupRel = await adminAgent
      .post(`/api/v1/products/itest-docs-alpha/documents/${docId}/relations`)
      .send({ targetId: doc2Id, relationType: 'specifies' });
    expect(dupRel.status).toBe(409);

    const selfRel = await adminAgent
      .post(`/api/v1/products/itest-docs-alpha/documents/${docId}/relations`)
      .send({ targetId: docId, relationType: 'relates_to' });
    expect(selfRel.status).toBe(422);

    const outgoing = await adminAgent.get(
      `/api/v1/products/itest-docs-alpha/documents/${docId}/relations?direction=out`,
    );
    expect(outgoing.status).toBe(200);
    expect(outgoing.body).toHaveLength(1);
    const incoming = await adminAgent.get(
      `/api/v1/products/itest-docs-alpha/documents/${doc2Id}/relations?direction=in`,
    );
    expect(incoming.body).toHaveLength(1);
  });

  it('adjuntos: subida válida, descarga segura, SVG malicioso rechazado', async () => {
    const upload = await adminAgent
      .post(`/api/v1/products/itest-docs-alpha/attachments?ownerId=${docId}`)
      .attach('file', PNG_MINIMAL, { filename: 'diagrama.png', contentType: 'image/png' });
    expect(upload.status).toBe(201);
    const attachmentId = upload.body.id as string;

    const download = await adminAgent.get(
      `/api/v1/products/itest-docs-alpha/attachments/${attachmentId}/download`,
    );
    expect(download.status).toBe(200);
    expect(download.headers['content-disposition']).toContain('attachment');
    expect(download.headers['x-content-type-options']).toBe('nosniff');
    expect(download.headers['content-security-policy']).toContain("default-src 'none'");

    const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    const rejected = await adminAgent
      .post(`/api/v1/products/itest-docs-alpha/attachments?ownerId=${docId}`)
      .attach('file', Buffer.from(malicious), {
        filename: 'evil.svg',
        contentType: 'image/svg+xml',
      });
    expect(rejected.status).toBe(422);
    expect(rejected.body.code).toBe('attachment.magic_mismatch');

    const badMime = await adminAgent
      .post(`/api/v1/products/itest-docs-alpha/attachments?ownerId=${docId}`)
      .attach('file', PNG_MINIMAL, {
        filename: 'disco.exe',
        contentType: 'application/octet-stream',
      });
    expect(badMime.status).toBe(422);
    expect(badMime.body.code).toBe('attachment.mime_not_allowed');

    const list = await adminAgent.get(
      `/api/v1/products/itest-docs-alpha/attachments?ownerId=${docId}`,
    );
    expect(list.body.map((a: { id: string }) => a.id)).toContain(attachmentId);
  });

  it('búsqueda FTS: «asignación» y código de nodo encuentran el documento', async () => {
    const byText = await adminAgent.get(
      `/api/v1/products/itest-docs-alpha/search?q=${encodeURIComponent('asignación')}`,
    );
    expect(byText.status).toBe(200);
    expect(byText.body.map((h: { id: string }) => h.id)).toContain(docId);

    const byCode = await adminAgent.get(
      `/api/v1/products/itest-docs-alpha/search?q=${encodeURIComponent(nodeCode)}`,
    );
    expect(byCode.status).toBe(200);
    expect(byCode.body.map((h: { id: string }) => h.id)).toContain(docId);
  });

  it('F2-SEC · tenant-escape: outsider 403; collaborator escribe pero no publica', async () => {
    expect((await outsiderAgent.get('/api/v1/products/itest-docs-alpha/documents')).status).toBe(
      403,
    );
    const invite = await adminAgent
      .post('/api/v1/products/itest-docs-alpha/members')
      .send({ email: 'docs-collab@itest.dev', roleKey: 'collaborator' });
    expect(invite.status).toBe(201);

    const created = await collaboratorAgent
      .post('/api/v1/products/itest-docs-alpha/documents')
      .send({ docTypeKey: 'workflow', title: 'Flujo desde colaborador' });
    expect(created.status).toBe(201);
    const denied = await collaboratorAgent
      .post(`/api/v1/products/itest-docs-alpha/documents/${created.body.id}/publish`)
      .send({ changeNote: 'intento' });
    expect(denied.status).toBe(403);

    expect((await outsiderAgent.get('/api/v1/products/itest-docs-beta/documents')).status).toBe(
      403,
    );
  });
});
