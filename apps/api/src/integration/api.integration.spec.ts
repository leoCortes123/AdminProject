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
      description: 'Pantalla de prueba para la ficha integral.',
      objective: 'Consolidar pedidos en rutas óptimas.',
    });
    expect(pant.status).toBe(201);
    expect(pant.body.description).toBe('Pantalla de prueba para la ficha integral.');
    expect(pant.body.objective).toBe('Consolidar pedidos en rutas óptimas.');
    const comp = await adminAgent.post('/api/v1/products/itest-alpha/nodes').send({
      parentId: pant.body.id,
      nodeTypeKey: 'componente',
      code: 'COMP-11',
      name: 'Componente Itest',
    });
    expect(comp.status).toBe(201);
    expect(comp.body.description).toBeNull();
    expect(comp.body.objective).toBeNull();

    // Ficha funcional (migración 0008): PATCH actualiza y `null` borra.
    const patch = await adminAgent.patch('/api/v1/products/itest-alpha/nodes/PANT-11').send({
      description: 'Descripción actualizada de la pantalla.',
      objective: 'Objetivo actualizado de la pantalla.',
    });
    expect(patch.status).toBe(200);
    expect(patch.body.description).toBe('Descripción actualizada de la pantalla.');
    expect(patch.body.objective).toBe('Objetivo actualizado de la pantalla.');

    // La búsqueda FTS encuentra el nodo por su descripción funcional.
    const search = await adminAgent.get(
      '/api/v1/products/itest-alpha/search?kinds=node&q=actualizada',
    );
    expect(search.status).toBe(200);
    expect(search.body.map((h: { code: string }) => h.code)).toContain('PANT-11');

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

    // El duplicado hereda descripción/objetivo de la ficha.
    const copyDetail = await adminAgent.get('/api/v1/products/itest-alpha/nodes/PANT-12');
    expect(copyDetail.status).toBe(200);
    expect(copyDetail.body.description).toBe('Descripción actualizada de la pantalla.');
    expect(copyDetail.body.objective).toBe('Objetivo actualizado de la pantalla.');

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

describe('DevCycle Trabajo F3 (integración · PG efímero)', () => {
  let taskId: string;
  let task2Id: string;
  let issueId: string;
  const nodeCode = 'PANT-61';

  beforeAll(async () => {
    for (const slug of ['itest-work-alpha']) {
      const res = await adminAgent
        .post('/api/v1/products')
        .send({ name: `Work ${slug}`, slug, techStack: ['NestJS'] });
      expect(res.status).toBe(201);
    }
    const mod = await adminAgent
      .post('/api/v1/products/itest-work-alpha/nodes')
      .send({ parentId: null, nodeTypeKey: 'modulo', code: 'MOD-61', name: 'Módulo work' });
    expect(mod.status).toBe(201);
    const pant = await adminAgent.post('/api/v1/products/itest-work-alpha/nodes').send({
      parentId: mod.body.id,
      nodeTypeKey: 'pantalla',
      code: nodeCode,
      name: 'Pantalla work',
    });
    expect(pant.status).toBe(201);
  }, 120_000);

  it('CRUD tareas: crear vinculada a nodo, criterios, visible en ambos lados', async () => {
    const created = await adminAgent.post('/api/v1/products/itest-work-alpha/tasks').send({
      code: 'TAR-061',
      title: 'Implementar asignación de pedidos',
      description: 'Consolidar pedidos en rutas óptimas.',
      type: 'development',
      priority: 'high',
      nodeCodes: [nodeCode],
      acceptanceCriteria: [{ text: 'Visualizar variantes sin reordenar', done: false }],
    });
    expect(created.status).toBe(201);
    expect(created.body.code).toBe('TAR-061');
    expect(created.body.stateKey).toBe('backlog');
    expect(created.body.nodeCodes).toContain(nodeCode);
    expect(created.body.acceptanceCriteria).toHaveLength(1);
    expect(created.body.blockedBy).toEqual([]);
    taskId = created.body.id;

    const dup = await adminAgent.post('/api/v1/products/itest-work-alpha/tasks').send({
      code: 'TAR-061',
      title: 'Duplicado',
    });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('task.code_conflict');

    const list = await adminAgent.get('/api/v1/products/itest-work-alpha/tasks');
    expect(list.status).toBe(200);
    expect(list.body.map((t: { id: string }) => t.id)).toContain(taskId);

    const byNode = await adminAgent.get(
      `/api/v1/products/itest-work-alpha/nodes/${nodeCode}/tasks`,
    );
    expect(byNode.status).toBe(200);
    expect(byNode.body.map((t: { id: string }) => t.id)).toContain(taskId);

    const search = await adminAgent.get(
      `/api/v1/products/itest-work-alpha/search?q=${encodeURIComponent(nodeCode)}&kinds=task`,
    );
    expect(search.status).toBe(200);
    expect(search.body.map((h: { id: string }) => h.id)).toContain(taskId);

    const states = await adminAgent.get('/api/v1/products/itest-work-alpha/tasks/states');
    expect(states.status).toBe(200);
    expect(states.body.length).toBeGreaterThanOrEqual(6);
  });

  it('transiciones: backlog→todo ok; backlog→done 409 task.invalid_transition', async () => {
    const ok = await adminAgent
      .post(`/api/v1/products/itest-work-alpha/tasks/${taskId}/status`)
      .send({ toStateKey: 'todo' });
    expect(ok.status).toBe(200);
    expect(ok.body.stateKey).toBe('todo');

    const bad = await adminAgent
      .post(`/api/v1/products/itest-work-alpha/tasks/${taskId}/status`)
      .send({ toStateKey: 'done' });
    expect(bad.status).toBe(409);
    expect(bad.body.code).toBe('task.invalid_transition');
  });

  it('dependencias: A blocks B ok; ciclo B blocks A → 422 legible', async () => {
    const second = await adminAgent.post('/api/v1/products/itest-work-alpha/tasks').send({
      title: 'Segunda tarea work',
      priority: 'medium',
    });
    expect(second.status).toBe(201);
    task2Id = second.body.id;

    const dep = await adminAgent
      .post(`/api/v1/products/itest-work-alpha/tasks/${taskId}/dependencies`)
      .send({ targetId: task2Id, relationType: 'blocks' });
    expect(dep.status).toBe(201);

    const cycle = await adminAgent
      .post(`/api/v1/products/itest-work-alpha/tasks/${task2Id}/dependencies`)
      .send({ targetId: taskId, relationType: 'blocks' });
    expect(cycle.status).toBe(422);

    const deps = await adminAgent.get(
      `/api/v1/products/itest-work-alpha/tasks/${taskId}/dependencies`,
    );
    expect(deps.status).toBe(200);
    expect(deps.body.blocks).toHaveLength(1);
    expect(deps.body.blocks[0].targetId).toBe(task2Id);
  });

  it('incidencias: crear vinculada, transiciones, vincular tarea correctiva', async () => {
    const created = await adminAgent.post('/api/v1/products/itest-work-alpha/issues').send({
      code: 'INC-061',
      title: 'Ficha no muestra variantes tras guardar',
      description: 'Al guardar, ver variantes actualizadas',
      expectedBehavior: 'Al guardar, ver variantes actualizadas',
      observedBehavior: 'Las variantes quedan obsoletas hasta recargar',
      reproductionSteps: ['1. Abrir pantalla', '2. Editar variante', '3. Guardar'],
      severity: 'high',
      priority: 'high',
      nodeCodes: [nodeCode],
    });
    expect(created.status).toBe(201);
    expect(created.body.code).toBe('INC-061');
    expect(created.body.stateKey).toBe('open');
    expect(created.body.nodeCodes).toContain(nodeCode);
    expect(created.body.reproductionSteps).toHaveLength(3);
    issueId = created.body.id;

    const byNode = await adminAgent.get(
      `/api/v1/products/itest-work-alpha/nodes/${nodeCode}/issues`,
    );
    expect(byNode.body.map((i: { id: string }) => i.id)).toContain(issueId);

    const bad = await adminAgent
      .post(`/api/v1/products/itest-work-alpha/issues/${issueId}/status`)
      .send({ toStateKey: 'closed' });
    // open → closed debe fallar (transición no declarada: open→closed requiere confirm pero existe? En seeds: open→closed existe con requiresConfirmation, así que puede pasar). Para que el test sea determinista, probamos una transición claramente inválida:
    // open → resolved no directo: open→in_progress→resolved, por lo que open→resolved es 409.
    if (bad.status === 200) {
      // Si la seed permite open→closed, la transición no inválida es open→resolved.
      const bad2 = await adminAgent
        .post(`/api/v1/products/itest-work-alpha/issues/${issueId}/status`)
        .send({ toStateKey: 'resolved' });
      // open→resolved no está declarada (solo open→in_progress, open→closed) → 409.
      expect(bad2.status).toBe(409);
      expect(bad2.body.code).toBe('issue.invalid_transition');
      // Volver a abrir para seguir el flujo.
      await adminAgent
        .post(`/api/v1/products/itest-work-alpha/issues/${issueId}/status`)
        .send({ toStateKey: 'open' });
    } else {
      expect(bad.status).toBe(409);
      expect(bad.body.code).toBe('issue.invalid_transition');
    }

    const linked = await adminAgent
      .post(`/api/v1/products/itest-work-alpha/issues/${issueId}/tasks`)
      .send({
        taskId,
      });
    expect(linked.status).toBe(201);

    const inc = await adminAgent.get(`/api/v1/products/itest-work-alpha/issues/${issueId}`);
    expect(inc.body.linkedTaskIds).toContain(taskId);
  });

  it('comentarios: crear en tarea con mención, listar, tenant-escape', async () => {
    const created = await adminAgent.post('/api/v1/products/itest-work-alpha/comments').send({
      parentKind: 'task',
      parentId: taskId,
      body: 'Revisar la asignación con @admin@itest.dev',
    });
    expect(created.status).toBe(201);
    expect(created.body.body).toContain('@admin');

    const list = await adminAgent.get(`/api/v1/products/itest-work-alpha/comments/task/${taskId}`);
    expect(list.body).toHaveLength(1);

    // tenant-escape: outsider no ve tareas de work-alpha
    expect((await outsiderAgent.get('/api/v1/products/itest-work-alpha/tasks')).status).toBe(403);
    expect((await outsiderAgent.get('/api/v1/products/itest-work-alpha/issues')).status).toBe(403);
  });
});

describe('DevCycle Trazabilidad F4 (integración · PG efímero)', () => {
  let collaboratorAgent: request.Agent;
  let modId: string;
  let taskId: string;
  let issueId: string;
  let tcId: string;
  const nodeCode = 'PANT-71';
  const moduleCode = 'MOD-71';
  const compCode = 'COMP-71';

  beforeAll(async () => {
    collaboratorAgent = request.agent(app.getHttpServer());
    const signupCollab = await collaboratorAgent.post('/api/auth/sign-up/email').send({
      name: 'Collab Trace',
      email: 'trace-collab@itest.dev',
      password: 'itest-password-123',
    });
    expect(signupCollab.status).toBe(200);

    for (const slug of ['itest-trace-alpha', 'itest-trace-beta']) {
      const res = await adminAgent
        .post('/api/v1/products')
        .send({ name: `Trace ${slug}`, slug, techStack: ['NestJS'] });
      expect(res.status).toBe(201);
    }
    const invite = await adminAgent
      .post('/api/v1/products/itest-trace-alpha/members')
      .send({ email: 'trace-collab@itest.dev', roleKey: 'collaborator' });
    expect(invite.status).toBe(201);

    const mod = await adminAgent
      .post('/api/v1/products/itest-trace-alpha/nodes')
      .send({ parentId: null, nodeTypeKey: 'modulo', code: moduleCode, name: 'Módulo trace' });
    expect(mod.status).toBe(201);
    const pant = await adminAgent.post('/api/v1/products/itest-trace-alpha/nodes').send({
      parentId: mod.body.id,
      nodeTypeKey: 'pantalla',
      code: nodeCode,
      name: 'Pantalla trace',
    });
    expect(pant.status).toBe(201);
    const comp = await adminAgent.post('/api/v1/products/itest-trace-alpha/nodes').send({
      parentId: pant.body.id,
      nodeTypeKey: 'componente',
      code: compCode,
      name: 'Componente trace',
    });
    expect(comp.status).toBe(201);

    // β: tarea ajena para el test de cross-product.
    const betaTask = await adminAgent.post('/api/v1/products/itest-trace-beta/tasks').send({
      title: 'Tarea beta (ajena)',
    });
    expect(betaTask.status).toBe(201);
    (globalThis as unknown as { __betaTaskId?: string }).__betaTaskId = betaTask.body.id as string;
  }, 120_000);

  it('changes CRUD: propose vinculado a nodo visible en ambos lados', async () => {
    const created = await adminAgent.post('/api/v1/products/itest-trace-alpha/changes').send({
      code: 'MOD-471',
      title: 'Reasignación limitada a 2 intentos (RN-014)',
      description: 'Bloquea el 3er intento en capa de dominio.',
      kind: 'functional',
      nodeCodes: [nodeCode],
    });
    expect(created.status).toBe(201);
    expect(created.body.code).toBe('MOD-471');
    expect(created.body.status).toBe('proposed');
    expect(created.body.nodeCodes).toContain(nodeCode);
    modId = created.body.id;

    const dup = await adminAgent.post('/api/v1/products/itest-trace-alpha/changes').send({
      code: 'MOD-471',
      title: 'Duplicado',
    });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('change.code_conflict');

    const byNode = await adminAgent.get(
      `/api/v1/products/itest-trace-alpha/nodes/${nodeCode}/changes`,
    );
    expect(byNode.status).toBe(200);
    expect(byNode.body.map((c: { id: string }) => c.id)).toContain(modId);

    const list = await adminAgent.get('/api/v1/products/itest-trace-alpha/changes?status=proposed');
    expect(list.body.map((c: { id: string }) => c.id)).toContain(modId);
  });

  it('execute con resolves: MOD ejecutada + INC resuelta atómicamente (409 si re-ejecuta)', async () => {
    const task = await adminAgent.post('/api/v1/products/itest-trace-alpha/tasks').send({
      code: 'TAR-471',
      title: 'Implementar límite RN-014',
      nodeCodes: [nodeCode],
    });
    expect(task.status).toBe(201);
    taskId = task.body.id;

    const issue = await adminAgent.post('/api/v1/products/itest-trace-alpha/issues').send({
      code: 'INC-471',
      title: 'Reasignación permite un 3er intento',
      expectedBehavior: 'Bloquear el 3er intento',
      observedBehavior: 'Acepta el 3er intento',
      nodeCodes: [nodeCode],
    });
    expect(issue.status).toBe(201);
    expect(issue.body.stateKey).toBe('open');
    issueId = issue.body.id;

    // Vincular la MOD como correctiva (resolves) + tarea (implements).
    const linked = await adminAgent
      .post(`/api/v1/products/itest-trace-alpha/changes/${modId}/resolves`)
      .send({ issueId });
    expect(linked.status).toBe(201);
    const linkedTask = await adminAgent
      .post(`/api/v1/products/itest-trace-alpha/changes/${modId}/tasks`)
      .send({ taskId });
    expect(linkedTask.status).toBe(201);

    // Colaborador puede proponer pero NO ejecutar (403 changes:execute).
    const forbidden = await collaboratorAgent
      .post(`/api/v1/products/itest-trace-alpha/changes/${modId}/execute`)
      .send({ gitSha: 'a3f9c21' });
    expect(forbidden.status).toBe(403);

    // Admin ejecuta: transacción MOD→INC atómica.
    const executed = await adminAgent
      .post(`/api/v1/products/itest-trace-alpha/changes/${modId}/execute`)
      .send({ gitSha: 'a3f9c21', gitBranch: 'main' });
    expect(executed.status).toBe(200);
    expect(executed.body.status).toBe('executed');
    expect(executed.body.gitSha).toBe('a3f9c21');
    expect(executed.body.resolvedIncidents).toContain(issueId);

    const inc = await adminAgent.get(`/api/v1/products/itest-trace-alpha/issues/${issueId}`);
    expect(inc.body.stateKey).toBe('resolved');
    expect(inc.body.resolvedAt).not.toBeNull();

    // Re-ejecutar → 409 change.already_executed.
    const twice = await adminAgent
      .post(`/api/v1/products/itest-trace-alpha/changes/${modId}/execute`)
      .send({});
    expect(twice.status).toBe(409);
    expect(twice.body.code).toBe('change.already_executed');
  });

  it('las 7 consultas canónicas responden con datos reales (Q1-Q7)', async () => {
    // Regla DOC-472 → PANT-71 (Q2) y CU DOC-471 (Q5) vía genéricas.
    const rule = await adminAgent.post('/api/v1/products/itest-trace-alpha/documents').send({
      docTypeKey: 'business_rule',
      code: 'DOC-472',
      title: 'Regla RN-471 — Reasignación máx. 2 veces',
      bodyMarkdown: 'Un pedido solo puede reasignarse 2 veces.',
    });
    expect(rule.status).toBe(201);
    const pantRes = await adminAgent.get('/api/v1/products/itest-trace-alpha/nodes');
    const pantId = (pantRes.body as Array<{ code: string; id: string }>).find(
      (n) => n.code === nodeCode,
    )?.id;
    const ruleRel = await adminAgent.post('/api/v1/products/itest-trace-alpha/relations').send({
      sourceKind: 'item',
      sourceId: rule.body.id,
      targetKind: 'node',
      targetId: pantId,
      relationType: 'applies_rule',
    });
    expect(ruleRel.status).toBe(201);

    const cu = await adminAgent.post('/api/v1/products/itest-trace-alpha/documents').send({
      docTypeKey: 'use_case',
      code: 'DOC-471',
      title: 'Caso de uso — Asignar pedido a ruta óptima',
      bodyMarkdown: 'Flujo principal y alternativos.',
      nodeCodes: [nodeCode],
    });
    expect(cu.status).toBe(201);

    const tc = await adminAgent.post('/api/v1/products/itest-trace-alpha/tests').send({
      code: 'TC-471',
      title: 'E2E asignación → factura',
      type: 'e2e',
      itemCodes: ['DOC-471'],
    });
    expect(tc.status).toBe(201);
    tcId = tc.body.id;
    const result = await adminAgent
      .post(`/api/v1/products/itest-trace-alpha/tests/${tcId}/results`)
      .send({ status: 'passed', environment: 'staging', notes: '12/12 OK' });
    expect(result.status).toBe(201);

    // Dependencia COMP-71 → PANT-71 (Q7).
    const compRes = await adminAgent.get('/api/v1/products/itest-trace-alpha/nodes');
    const compId = (compRes.body as Array<{ code: string; id: string }>).find(
      (n) => n.code === compCode,
    )?.id;
    const dep = await adminAgent.post('/api/v1/products/itest-trace-alpha/relations').send({
      sourceKind: 'node',
      sourceId: compId,
      targetKind: 'node',
      targetId: pantId,
      relationType: 'depends_on',
    });
    expect(dep.status).toBe(201);

    // Q1: tareas que afectan la pantalla.
    const q1 = await adminAgent.get(
      `/api/v1/products/itest-trace-alpha/trace/tasks-affecting-node?nodeCode=${nodeCode}`,
    );
    expect(q1.status).toBe(200);
    expect(q1.body.map((r: { id: string }) => r.id)).toContain(taskId);

    // Q2: pantallas que utilizan la regla.
    const q2 = await adminAgent.get(
      '/api/v1/products/itest-trace-alpha/trace/screens-using-rule?itemCode=DOC-472',
    );
    expect(q2.status).toBe(200);
    expect(q2.body.map((r: { code: string }) => r.code)).toContain(nodeCode);

    // Q3: documentos que describen el proceso.
    const q3 = await adminAgent.get(
      `/api/v1/products/itest-trace-alpha/trace/documents-for-node?nodeCode=${nodeCode}`,
    );
    expect(q3.body.map((r: { code: string }) => r.code)).toContain('DOC-471');

    // Q4: modificaciones que implementaron la funcionalidad.
    const q4 = await adminAgent.get(
      `/api/v1/products/itest-trace-alpha/trace/changes-for-node?nodeCode=${nodeCode}`,
    );
    expect(q4.body.map((r: { id: string }) => r.id)).toContain(modId);

    // Q5: pruebas que validan el caso de uso.
    const q5 = await adminAgent.get(
      '/api/v1/products/itest-trace-alpha/trace/tests-for-document?itemCode=DOC-471',
    );
    expect(q5.body.map((r: { id: string }) => r.id)).toContain(tcId);

    // Q6: incidencias del módulo (subárbol: PANT-71 + COMP-71).
    // La INC-471 está en PANT-71; debe aparecer también consultando el módulo MOD-71.
    const q6 = await adminAgent.get(
      `/api/v1/products/itest-trace-alpha/trace/issues-for-module?nodeCode=${moduleCode}`,
    );
    expect(q6.body.map((r: { id: string }) => r.id)).toContain(issueId);

    // Q7: funcionalidades que dependen del componente.
    const q7 = await adminAgent.get(
      `/api/v1/products/itest-trace-alpha/trace/dependents-for-node?nodeCode=${nodeCode}&depth=1`,
    );
    expect(q7.body.map((r: { code: string }) => r.code)).toContain(compCode);

    // Grafo: centro + vecinos no vacío.
    const graph = await adminAgent.get(
      `/api/v1/products/itest-trace-alpha/trace/graph?nodeCode=${nodeCode}&depth=1`,
    );
    expect(graph.body.center.code).toBe(nodeCode);
    expect(graph.body.nodes.length).toBeGreaterThan(1);
    expect(graph.body.edges.length).toBeGreaterThan(0);

    // Ficha: relaciones salientes/entrantes + historial unificado + cambios del nodo.
    const relationsOut = await adminAgent.get(
      `/api/v1/products/itest-trace-alpha/nodes/${nodeCode}/relations?direction=out`,
    );
    expect(relationsOut.status).toBe(200);
    const relationsIn = await adminAgent.get(
      `/api/v1/products/itest-trace-alpha/nodes/${nodeCode}/relations?direction=in`,
    );
    expect(relationsIn.status).toBe(200);
    expect(relationsIn.body.length).toBeGreaterThan(0);

    const history = await adminAgent.get(
      `/api/v1/products/itest-trace-alpha/nodes/${nodeCode}/history`,
    );
    expect(history.status).toBe(200);
    expect(history.body.length).toBeGreaterThan(0);
    expect(history.body[0]).toMatchObject({ summary: expect.any(String) });

    const nodeChanges = await adminAgent.get(
      `/api/v1/products/itest-trace-alpha/nodes/${nodeCode}/changes`,
    );
    expect(nodeChanges.body.map((c: { id: string }) => c.id)).toContain(modId);
  });

  it('relations endurecidas: inexistente → 422, cross-product → 422, duplicado → 409, sweep 0 huérfanos', async () => {
    // Inexistente.
    const bogus = await adminAgent.post('/api/v1/products/itest-trace-alpha/relations').send({
      sourceKind: 'change',
      sourceId: modId,
      targetKind: 'task',
      targetId: '00000000-0000-0000-0000-000000000000',
      relationType: 'relates_to',
    });
    expect(bogus.status).toBe(422);

    // Cross-product: tarea de β no visible desde α.
    const betaTaskId = (globalThis as unknown as { __betaTaskId?: string }).__betaTaskId as string;
    const cross = await adminAgent.post('/api/v1/products/itest-trace-alpha/relations').send({
      sourceKind: 'change',
      sourceId: modId,
      targetKind: 'task',
      targetId: betaTaskId,
      relationType: 'relates_to',
    });
    expect(cross.status).toBe(422);

    // Duplicado exacto → 409 (Q5 ya creó change→? no; el duplicado es change→task implements).
    const dup = await adminAgent.post('/api/v1/products/itest-trace-alpha/relations').send({
      sourceKind: 'change',
      sourceId: modId,
      targetKind: 'task',
      targetId: taskId,
      relationType: 'implements',
    });
    expect(dup.status).toBe(409);

    // Auto-relación → 422 vía trigger (mismo kind+id).
    const self = await adminAgent.post('/api/v1/products/itest-trace-alpha/relations').send({
      sourceKind: 'change',
      sourceId: modId,
      targetKind: 'change',
      targetId: modId,
      relationType: 'relates_to',
    });
    expect(self.status).toBe(422);

    // Sweep: triggers garantizan 0 huérfanos.
    const sweep = await adminAgent.post('/api/v1/products/itest-trace-alpha/trace/sweep');
    expect(sweep.status).toBe(200);
    expect(sweep.body.orphans).toBe(0);
  });

  it('property: 50 operaciones aleatorias sobre relations → sweep sigue en 0 huérfanos', async () => {
    const rng = mulberry32(20261107);
    const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]!;
    // Universo mínimo: 2 cambios + 2 tareas (+ nodo) ya creados/vinculados.
    const second = await adminAgent.post('/api/v1/products/itest-trace-alpha/changes').send({
      title: 'MOD aleatoria para property',
    });
    expect(second.status).toBe(201);
    const secondId = second.body.id as string;
    const secondTask = await adminAgent.post('/api/v1/products/itest-trace-alpha/tasks').send({
      title: 'Tarea aleatoria para property',
    });
    expect(secondTask.status).toBe(201);
    const secondTaskId = secondTask.body.id as string;

    const sources = [modId, secondId];
    const targets = [taskId, secondTaskId];
    const types = ['relates_to', 'implements', 'affects'] as const;
    for (let i = 0; i < 50; i++) {
      const res = await adminAgent.post('/api/v1/products/itest-trace-alpha/relations').send({
        sourceKind: 'change',
        sourceId: pick(sources),
        targetKind: 'task',
        targetId: pick(targets),
        relationType: pick([...types]),
      });
      expect([201, 409]).toContain(res.status);
    }
    const sweep = await adminAgent.post('/api/v1/products/itest-trace-alpha/trace/sweep');
    expect(sweep.status).toBe(200);
    expect(sweep.body.orphans).toBe(0);
  });

  it('F4-SEC · tenant-escape: outsider 403; viewer lee cambios/trace pero no propone', async () => {
    expect((await outsiderAgent.get('/api/v1/products/itest-trace-alpha/changes')).status).toBe(
      403,
    );
    expect(
      (
        await outsiderAgent.get(
          '/api/v1/products/itest-trace-alpha/trace/tasks-affecting-node?nodeCode=PANT-71',
        )
      ).status,
    ).toBe(403);

    // Colaborador sí puede proponer, pero no ejecutar (ya verificado arriba);
    // el outsider como viewer de itest-alpha no llega a trace-alpha.
    expect((await outsiderAgent.get('/api/v1/products/itest-trace-beta/changes')).status).toBe(403);
  });
});

describe('DevCycle Seguimiento F5 (integración · PG efímero)', () => {
  const moduleCode = 'MOD-81';
  const pantDocCode = 'PANT-81';
  const pantNoDocCode = 'PANT-82';

  beforeAll(async () => {
    for (const slug of ['itest-followup-alpha', 'itest-followup-beta']) {
      const res = await adminAgent
        .post('/api/v1/products')
        .send({ name: `Followup ${slug}`, slug, techStack: ['NestJS'] });
      expect(res.status).toBe(201);
    }
    const mod = await adminAgent.post('/api/v1/products/itest-followup-alpha/nodes').send({
      parentId: null,
      nodeTypeKey: 'modulo',
      code: moduleCode,
      name: 'Módulo seguimiento',
    });
    expect(mod.status).toBe(201);
    const pantDoc = await adminAgent.post('/api/v1/products/itest-followup-alpha/nodes').send({
      parentId: mod.body.id,
      nodeTypeKey: 'pantalla',
      code: pantDocCode,
      name: 'Pantalla con todo',
    });
    expect(pantDoc.status).toBe(201);
    const pantNoDoc = await adminAgent.post('/api/v1/products/itest-followup-alpha/nodes').send({
      parentId: mod.body.id,
      nodeTypeKey: 'pantalla',
      code: pantNoDocCode,
      name: 'Pantalla sin nada',
    });
    expect(pantNoDoc.status).toBe(201);
    (globalThis as unknown as { __pantDocId?: string }).__pantDocId = pantDoc.body.id as string;
    (globalThis as unknown as { __pantNoDocId?: string }).__pantNoDocId = pantNoDoc.body
      .id as string;
    (globalThis as unknown as { __mod81Id?: string }).__mod81Id = mod.body.id as string;
  }, 120_000);

  it('F5-T01 · overview: avance real por conteo de tareas tras completar 1 tarea', async () => {
    const t1 = await adminAgent.post('/api/v1/products/itest-followup-alpha/tasks').send({
      code: 'TAR-481',
      title: 'Tarea seguimiento 1 — asignación de ruta',
      nodeCodes: [pantDocCode],
    });
    expect(t1.status).toBe(201);
    const t2 = await adminAgent.post('/api/v1/products/itest-followup-alpha/tasks').send({
      code: 'TAR-482',
      title: 'Tarea seguimiento 2 — timbrado',
      nodeCodes: [pantDocCode],
    });
    expect(t2.status).toBe(201);
    const t1Id = t1.body.id as string;
    (globalThis as unknown as { __tar481Id?: string }).__tar481Id = t1Id;

    const before = await adminAgent.get('/api/v1/products/itest-followup-alpha/overview');
    expect(before.status).toBe(200);
    expect(before.body.counts.tasksTotal).toBeGreaterThanOrEqual(2);
    expect(before.body.counts.tasksDone).toBe(0);
    expect(before.body.avancePct).toBe(0);
    expect(before.body.modules.some((m: { code: string }) => m.code === moduleCode)).toBe(true);

    // backlog → todo → in_progress → in_review → done.
    for (const to of ['todo', 'in_progress', 'in_review', 'done']) {
      const res = await adminAgent
        .post(`/api/v1/products/itest-followup-alpha/tasks/${t1Id}/status`)
        .send({ toStateKey: to });
      expect(res.status).toBe(200);
    }

    const after = await adminAgent.get('/api/v1/products/itest-followup-alpha/overview');
    expect(after.status).toBe(200);
    expect(after.body.counts.tasksDone).toBe(1);
    expect(after.body.counts.tasksOpen).toBe(after.body.counts.tasksTotal - 1);
    expect(after.body.avancePct).toBe(Math.round((1 / after.body.counts.tasksTotal) * 100));
    const modRow = (
      after.body.modules as Array<{
        code: string;
        pct: number;
        tasksDone: number;
        tasksTotal: number;
      }>
    ).find((m) => m.code === moduleCode);
    expect(modRow?.tasksDone).toBe(1);
    expect(modRow?.pct).toBe(Math.round((1 / (modRow?.tasksTotal ?? 1)) * 100));
  });

  it('F5-T02 · coverage: sin doc / sin pruebas exactos por ausencia de relations', async () => {
    // PANT-81: documento + caso de prueba que verifica el CU.
    const doc = await adminAgent.post('/api/v1/products/itest-followup-alpha/documents').send({
      docTypeKey: 'use_case',
      code: 'CU-481',
      title: 'CU asignación de ruta óptima',
      bodyMarkdown: 'Flujo asignar pedido a ruta.',
      nodeCodes: [pantDocCode],
    });
    expect(doc.status).toBe(201);
    const tc = await adminAgent.post('/api/v1/products/itest-followup-alpha/tests').send({
      code: 'TC-481',
      title: 'E2E asignación → factura',
      type: 'e2e',
      itemCodes: ['CU-481'],
    });
    expect(tc.status).toBe(201);

    const coverage = await adminAgent.get('/api/v1/products/itest-followup-alpha/coverage');
    expect(coverage.status).toBe(200);
    expect(coverage.body.totalNodes).toBe(3);
    const withoutDocs: string[] = (coverage.body.withoutDocsList as Array<{ code: string }>).map(
      (n) => n.code,
    );
    const withoutTests: string[] = (coverage.body.withoutTestsList as Array<{ code: string }>).map(
      (n) => n.code,
    );
    expect(withoutDocs).toContain(pantNoDocCode);
    expect(withoutDocs).not.toContain(pantDocCode);
    expect(withoutTests).toContain(pantNoDocCode);
    expect(withoutTests).not.toContain(pantDocCode);
    expect(coverage.body.pctDocs).toBe(Math.round((coverage.body.withDocs / 3) * 100));
    expect(coverage.body.withoutDocs).toBe(withoutDocs.length);
  });

  it('F5-T03 · activity: cursor-paginado estable (50/pág) + filtro actor', async () => {
    const page1 = await adminAgent.get('/api/v1/products/itest-followup-alpha/activity?limit=3');
    expect(page1.status).toBe(200);
    expect(Array.isArray(page1.body.items)).toBe(true);
    expect(page1.body.items.length).toBeGreaterThan(0);
    // Orden estable desc: createdAt no creciente.
    const times = (page1.body.items as Array<{ createdAt: string }>).map((e) =>
      new Date(e.createdAt).getTime(),
    );
    for (let i = 1; i < times.length; i++) {
      expect(times[i]! <= times[i - 1]!).toBe(true);
    }
    if (page1.body.nextCursor) {
      const page2 = await adminAgent.get(
        `/api/v1/products/itest-followup-alpha/activity?limit=3&cursor=${encodeURIComponent(page1.body.nextCursor)}`,
      );
      expect(page2.status).toBe(200);
      expect(page2.body.items.length).toBeGreaterThan(0);
      // Sin solapamiento entre páginas.
      const ids1 = new Set((page1.body.items as Array<{ id: string }>).map((e) => e.id));
      for (const item of page2.body.items as Array<{ id: string }>) {
        expect(ids1.has(item.id)).toBe(false);
      }
    }
    const humans = await adminAgent.get(
      '/api/v1/products/itest-followup-alpha/activity?actorType=human&limit=50',
    );
    expect(humans.status).toBe(200);
    for (const entry of humans.body.items as Array<{ actorType: string }>) {
      expect(entry.actorType).toBe('human');
    }
    // Cursor inválido se ignora (primera página, no 500).
    const badCursor = await adminAgent.get(
      '/api/v1/products/itest-followup-alpha/activity?cursor=xxx&limit=5',
    );
    expect(badCursor.status).toBe(200);
    expect(Array.isArray(badCursor.body.items)).toBe(true);
  });

  it('F5-T05 · búsqueda global: 6 kinds + código PANT + texto libre con ranking', async () => {
    const change = await adminAgent.post('/api/v1/products/itest-followup-alpha/changes').send({
      code: 'MOD-481',
      title: 'Reasignación limitada a 2 intentos',
      description: 'Bloquea el tercer intento en dominio.',
      nodeCodes: [pantDocCode],
    });
    expect(change.status).toBe(201);
    const issue = await adminAgent.post('/api/v1/products/itest-followup-alpha/issues').send({
      title: 'Reasignación supera el límite RN-014',
      description: 'El sistema permite un tercer intento.',
      observedBehavior: 'Permite reasignar 3 veces.',
      nodeCodes: [pantDocCode],
    });
    expect(issue.status).toBe(201);

    const byCode = await adminAgent.get(
      `/api/v1/products/itest-followup-alpha/search?q=${encodeURIComponent(pantDocCode)}&kinds=document,node,task,issue,change,test_case`,
    );
    expect(byCode.status).toBe(200);
    const hitKinds = (byCode.body as Array<{ kind: string; code: string | null }>).map(
      (h) => `${h.kind}:${h.code ?? ''}`,
    );
    expect(hitKinds).toContain(`node:${pantDocCode}`);
    expect(hitKinds.some((h: string) => h.startsWith('document:'))).toBe(true);

    const byText = await adminAgent.get(
      `/api/v1/products/itest-followup-alpha/search?q=${encodeURIComponent('asignación')}&kinds=document,task,change&limit=20`,
    );
    expect(byText.status).toBe(200);
    expect((byText.body as Array<{ id: string }>).length).toBeGreaterThan(0);
    // Ranking: los hits vienen ordenados por rank desc.
    const ranks = (byText.body as Array<{ rank: number }>).map((h) => h.rank);
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]! <= ranks[i - 1]!).toBe(true);
    }
    const testHit = await adminAgent.get(
      `/api/v1/products/itest-followup-alpha/search?q=${encodeURIComponent('TC-481')}&kinds=test_case`,
    );
    expect(testHit.status).toBe(200);
    expect((testHit.body as Array<{ code: string | null }>).map((h) => h.code)).toContain('TC-481');
    const changeHit = await adminAgent.get(
      `/api/v1/products/itest-followup-alpha/search?q=${encodeURIComponent('MOD-481')}&kinds=change`,
    );
    expect(changeHit.status).toBe(200);
    expect((changeHit.body as Array<{ code: string | null }>).map((h) => h.code)).toContain(
      'MOD-481',
    );
  });

  it('F5-T06 · export CSV: BOM + ; + cabeceras para Excel-ES', async () => {
    for (const kind of ['tasks', 'issues', 'changes']) {
      const res = await adminAgent.get(`/api/v1/products/itest-followup-alpha/export?kind=${kind}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain(`${kind}.csv`);
      expect(res.text.charCodeAt(0)).toBe(0xfeff);
      expect(res.text).toContain(';');
      expect(res.text.split('\r\n').length).toBeGreaterThan(1);
    }
    const tasksCsv = await adminAgent.get(
      '/api/v1/products/itest-followup-alpha/export?kind=tasks',
    );
    expect(tasksCsv.text).toContain('TAR-481');
    const badKind = await adminAgent.get('/api/v1/products/itest-followup-alpha/export?kind=nope');
    expect(badKind.status).toBe(400);
  });

  it('F5-SEC · tenant-escape: outsider 403 en overview/coverage/activity/export/search', async () => {
    expect((await outsiderAgent.get('/api/v1/products/itest-followup-alpha/overview')).status).toBe(
      403,
    );
    expect((await outsiderAgent.get('/api/v1/products/itest-followup-alpha/coverage')).status).toBe(
      403,
    );
    expect((await outsiderAgent.get('/api/v1/products/itest-followup-alpha/activity')).status).toBe(
      403,
    );
    expect(
      (await outsiderAgent.get('/api/v1/products/itest-followup-alpha/export?kind=tasks')).status,
    ).toBe(403);
    expect(
      (await outsiderAgent.get('/api/v1/products/itest-followup-alpha/search?q=hola')).status,
    ).toBe(403);
  });
});

describe('DevCycle Integraciones F6a (integración · PG efímero)', () => {
  const alpha = 'itest-integration-alpha';
  const beta = 'itest-integration-beta';
  const nodeCode = 'PANT-91';
  let serviceAccountId = '';
  let plainToken = '';
  let limitedToken = '';

  beforeAll(async () => {
    for (const slug of [alpha, beta]) {
      const res = await adminAgent
        .post('/api/v1/products')
        .send({ name: `Integration ${slug}`, slug, techStack: ['NestJS'] });
      expect(res.status).toBe(201);
    }
    const mod = await adminAgent.post(`/api/v1/products/${alpha}/nodes`).send({
      parentId: null,
      nodeTypeKey: 'modulo',
      code: 'MOD-91',
      name: 'Módulo integración',
    });
    expect(mod.status).toBe(201);
    const pant = await adminAgent.post(`/api/v1/products/${alpha}/nodes`).send({
      parentId: mod.body.id,
      nodeTypeKey: 'pantalla',
      code: nodeCode,
      name: 'Pantalla integración',
    });
    expect(pant.status).toBe(201);
    const task = await adminAgent.post(`/api/v1/products/${alpha}/tasks`).send({
      code: 'TAR-991',
      title: 'Tarea integración TAR-991',
      nodeCodes: [nodeCode],
    });
    expect(task.status).toBe(201);
    const doc = await adminAgent.post(`/api/v1/products/${alpha}/documents`).send({
      docTypeKey: 'spec',
      code: 'DOC-991',
      title: 'Spec integración',
      bodyMarkdown: 'Especificación de la pantalla de integración.',
      nodeCodes: [nodeCode],
    });
    expect(doc.status).toBe(201);

    const account = await adminAgent
      .post(`/api/v1/products/${alpha}/integration/service-accounts`)
      .send({ name: 'itest-agent', agentKind: 'claude-code' });
    expect(account.status).toBe(201);
    serviceAccountId = account.body.id as string;
    expect(serviceAccountId).toBeTruthy();

    const token = await adminAgent
      .post(`/api/v1/products/${alpha}/integration/tokens`)
      .send({ serviceAccountId, scopes: [], expiresInDays: 30, label: 'read-only' });
    expect(token.status).toBe(201);
    plainToken = token.body.token as string;
    expect(plainToken.startsWith('dvc_')).toBe(true);
    expect(token.body.tokenPrefix.startsWith('dvc_')).toBe(true);

    const limited = await adminAgent
      .post(`/api/v1/products/${alpha}/integration/tokens`)
      .send({ serviceAccountId, scopes: ['read:products'], label: 'limited' });
    expect(limited.status).toBe(201);
    limitedToken = limited.body.token as string;
  }, 120_000);

  it('F6a-T01 · tokens: listado sin secretos, revocado → 401 y tenant-escape por slug', async () => {
    const list = await adminAgent.get(
      `/api/v1/products/${alpha}/integration/service-accounts/${serviceAccountId}/tokens`,
    );
    expect(list.status).toBe(200);
    const prefixes: string[] = (list.body as Array<{ tokenPrefix: string }>).map(
      (t) => t.tokenPrefix,
    );
    expect(prefixes.length).toBeGreaterThanOrEqual(2);
    // Nunca el token en claro en listados.
    expect(JSON.stringify(list.body)).not.toContain(plainToken);
    expect(JSON.stringify(list.body)).not.toContain(limitedToken);

    // Sin Bearer → 401 problem+json.
    const noAuth = await request(app.getHttpServer()).get(`/api/v1/integration/products/${alpha}`);
    expect(noAuth.status).toBe(401);
    expect(noAuth.body.code).toBe('auth.required');

    // Token correcto lee su producto.
    const ok = await request(app.getHttpServer())
      .get(`/api/v1/integration/products/${alpha}`)
      .set('Authorization', `Bearer ${plainToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body.slug).toBe(alpha);

    // Tenant-escape: mismo token contra beta → 403.
    const escape = await request(app.getHttpServer())
      .get(`/api/v1/integration/products/${beta}`)
      .set('Authorization', `Bearer ${plainToken}`);
    expect(escape.status).toBe(403);

    // Scope insuficiente (limited: solo read:products) → 403 en structure.
    const scoped = await request(app.getHttpServer())
      .get(`/api/v1/integration/products/${alpha}/structure`)
      .set('Authorization', `Bearer ${limitedToken}`);
    expect(scoped.status).toBe(403);
  });

  it('F6a-T02 · /integration/* read-only: structure/node/context/docs/tasks/search/overview', async () => {
    const bearer = { Authorization: `Bearer ${plainToken}` };
    const structure = await request(app.getHttpServer())
      .get(`/api/v1/integration/products/${alpha}/structure`)
      .set(bearer);
    expect(structure.status).toBe(200);
    expect((structure.body as Array<{ code: string }>).map((n) => n.code)).toContain(nodeCode);

    const node = await request(app.getHttpServer())
      .get(`/api/v1/integration/products/${alpha}/nodes/${nodeCode}`)
      .set(bearer);
    expect(node.status).toBe(200);
    expect(node.body.code).toBe(nodeCode);

    const context = await request(app.getHttpServer())
      .get(`/api/v1/integration/products/${alpha}/nodes/${nodeCode}/context`)
      .set(bearer);
    expect(context.status).toBe(200);
    expect(context.body.target.code).toBe(nodeCode);
    expect(JSON.stringify(context.body).length).toBeLessThanOrEqual(32_768);

    const docs = await request(app.getHttpServer())
      .get(`/api/v1/integration/products/${alpha}/documents?nodeCode=${nodeCode}`)
      .set(bearer);
    expect(docs.status).toBe(200);
    expect((docs.body as Array<{ code: string | null }>).map((d) => d.code)).toContain('DOC-991');

    const tasks = await request(app.getHttpServer())
      .get(`/api/v1/integration/products/${alpha}/tasks?nodeCode=${nodeCode}`)
      .set(bearer);
    expect(tasks.status).toBe(200);
    expect((tasks.body as Array<{ code: string | null }>).map((t) => t.code)).toContain('TAR-991');

    const search = await request(app.getHttpServer())
      .get(`/api/v1/integration/products/${alpha}/search?q=${nodeCode}&kinds=node,document`)
      .set(bearer);
    expect(search.status).toBe(200);
    expect((search.body as Array<{ code: string | null }>).map((h) => h.code)).toContain(nodeCode);

    const overview = await request(app.getHttpServer())
      .get(`/api/v1/integration/products/${alpha}/overview`)
      .set(bearer);
    expect(overview.status).toBe(200);
    expect(overview.body.counts.tasksTotal).toBeGreaterThanOrEqual(1);

    expect(
      (
        await request(app.getHttpServer())
          .get(`/api/v1/integration/products/${alpha}/issues`)
          .set(bearer)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app.getHttpServer())
          .get(`/api/v1/integration/products/${alpha}/changes?nodeCode=${nodeCode}`)
          .set(bearer)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app.getHttpServer())
          .get(`/api/v1/integration/products/${alpha}/tests`)
          .set(bearer)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app.getHttpServer())
          .get(`/api/v1/integration/products/${alpha}/nodes/${nodeCode}/history`)
          .set(bearer)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app.getHttpServer())
          .get(`/api/v1/integration/products/${alpha}/trace/graph?nodeCode=${nodeCode}&depth=1`)
          .set(bearer)
      ).status,
    ).toBe(200);
  });

  it('F6a-T03 · auditoría: agent_executions + activity_log actor agent', async () => {
    const executions = await adminAgent.get(`/api/v1/products/${alpha}/integration/executions`);
    expect(executions.status).toBe(200);
    const rows = executions.body as Array<{
      toolName: string | null;
      status: string;
      serviceAccountId: string | null;
    }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.toolName === 'get_product')).toBe(true);
    expect(rows.some((r) => r.serviceAccountId === serviceAccountId)).toBe(true);
    // La auditoría no contiene el token en claro.
    expect(JSON.stringify(rows)).not.toContain(plainToken);

    const agents = await adminAgent.get(
      `/api/v1/products/${alpha}/activity?actorType=agent&limit=50`,
    );
    expect(agents.status).toBe(200);
    expect(
      (agents.body.items as Array<{ actorType: string }>).every((e) => e.actorType === 'agent'),
    ).toBe(true);
    expect(
      (agents.body.items as Array<{ action: string }>).some((e) =>
        e.action.startsWith('integration.'),
      ),
    ).toBe(true);
  });

  it('F6a-T01 · revoke instantáneo: token revocado → 401 en la siguiente llamada', async () => {
    const toRevoke = await adminAgent
      .post(`/api/v1/products/${alpha}/integration/tokens`)
      .send({ serviceAccountId, scopes: ['read:products'], label: 'to-revoke' });
    expect(toRevoke.status).toBe(201);
    const tempToken = toRevoke.body.token as string;
    const tempId = toRevoke.body.id as string;

    expect(
      (
        await request(app.getHttpServer())
          .get(`/api/v1/integration/products/${alpha}`)
          .set('Authorization', `Bearer ${tempToken}`)
      ).status,
    ).toBe(200);

    const revoke = await adminAgent
      .post(`/api/v1/products/${alpha}/integration/tokens/${tempId}/revoke`)
      .send({});
    expect(revoke.status).toBe(200);

    expect(
      (
        await request(app.getHttpServer())
          .get(`/api/v1/integration/products/${alpha}`)
          .set('Authorization', `Bearer ${tempToken}`)
      ).status,
    ).toBe(401);
  });

  it('F6a-T02 · OpenAPI integration-v1 disponible y admin requiere sesión+permiso', async () => {
    const docs = await request(app.getHttpServer()).get('/api/v1/docs/integration');
    expect(docs.status).toBe(200);

    const noSession = await request(app.getHttpServer())
      .post(`/api/v1/products/${alpha}/integration/service-accounts`)
      .send({ name: 'no-session', agentKind: 'agent' });
    expect(noSession.status).toBe(401);

    const outsider = await outsiderAgent
      .post(`/api/v1/products/${alpha}/integration/service-accounts`)
      .send({ name: 'outsider', agentKind: 'agent' });
    expect(outsider.status).toBe(403);
  });
});
