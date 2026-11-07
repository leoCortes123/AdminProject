import { Injectable } from '@nestjs/common';
import { CONTEXT_MAX_BYTES, type ContextSection, parseContextSections } from '@devcycle/shared';
import { NodesService } from '../nodes/nodes.service';
import { DocumentsService } from '../documents/documents.service';
import { TasksService } from '../work/tasks.service';
import { IssuesService } from '../work/issues.service';
import { ChangesService } from '../trace/changes.service';
import { TestCasesService } from '../trace/testcases.service';
import { TraceService } from '../trace/trace.service';
import { FollowupService } from '../followup/followup.service';

export interface ProductContext {
  target: {
    code: string;
    name: string;
    path: string;
    status: string;
    nodeTypeKey: string;
    /** Descripción funcional breve declarada en el nodo (Ficha · Resumen). */
    description: string | null;
    /** Objetivo funcional declarado en el nodo (Ficha · Funcionalidad). */
    objective: string | null;
  };
  functional?: string;
  documents?: Array<{ code: string | null; title: string; version: number; status: string }>;
  businessRules?: Array<{
    code: string | null;
    title: string;
    condition?: string | null;
    action?: string | null;
  }>;
  useCases?: Array<{
    code: string | null;
    title: string;
    actor?: string | null;
    goal?: string | null;
  }>;
  nonFunctionalRequirements?: Array<{
    code: string | null;
    title: string;
    category?: string | null;
    metric?: string | null;
    threshold?: string | null;
  }>;
  dataModel?: Array<{ code: string | null; title: string }>;
  apiContracts?: Array<{ code: string | null; title: string }>;
  pendingTasks?: Array<{ code: string | null; title: string; stateKey: string; priority: string }>;
  openIssues?: Array<{ code: string | null; title: string; severity: string; stateKey: string }>;
  decisions?: Array<{ code: string | null; title: string }>;
  dependencies?: Array<{ code: string | null; kind: string; relation: string }>;
  recentHistory?: Array<{ at: string; actorType: string; summary: string }>;
  truncated?: boolean;
}

const LIST_CAP = 10;

/** Trunca listas a 10 ítems y marca truncamiento a nivel de sección. */
function cap<T>(items: T[]): { items: T[]; truncated: boolean } {
  if (items.length <= LIST_CAP) return { items, truncated: false };
  return { items: items.slice(0, LIST_CAP), truncated: true };
}

/**
 * Totales de sección (count real) para que el agente sepa cuánto falta
 * sin recibir cuerpos completos (06-integraciones §6).
 */
@Injectable()
export class IntegrationContextService {
  constructor(
    private readonly nodes: NodesService,
    private readonly docs: DocumentsService,
    private readonly tasks: TasksService,
    private readonly issues: IssuesService,
    private readonly changes: ChangesService,
    private readonly tests: TestCasesService,
    private readonly trace: TraceService,
    private readonly followup: FollowupService,
  ) {}

  /**
   * Un solo call con lo necesario para trabajar sobre un nodo/módulo
   * (target + `sections[]` + truncamiento + presupuesto 32 KB).
   */
  async getProductContext(
    productId: string,
    nodeCode: string,
    rawSections?: string,
    maxBytes = CONTEXT_MAX_BYTES,
  ): Promise<ProductContext> {
    const sections = new Set(parseContextSections(rawSections));
    const node = await this.nodes.getNode(productId, nodeCode);

    const base: ProductContext = {
      target: {
        code: node.code,
        name: node.name,
        path: node.path,
        status: node.status,
        nodeTypeKey: node.nodeType.key,
        description: node.description ?? null,
        objective: node.objective ?? null,
      },
    };

    const wants = (id: ContextSection) => sections.has(id);

    // Reunir en paralelo (best-effort: lo no pedido no se consulta).
    const [linkedDocs, nodeTasks, nodeIssues, nodeChanges, nodeRelations, nodeHistory] =
      await Promise.all([
        wants('docs') ||
        wants('functional') ||
        wants('rules') ||
        wants('useCases') ||
        wants('nfr') ||
        wants('dataModel') ||
        wants('apiContracts') ||
        wants('decisions')
          ? this.docs.listForNode(productId, nodeCode).catch(() => [])
          : Promise.resolve([]),
        wants('pendingTasks')
          ? this.tasks.listForNode(productId, nodeCode).catch(() => [])
          : Promise.resolve([]),
        wants('openIssues')
          ? this.issues.listForNode(productId, nodeCode).catch(() => [])
          : Promise.resolve([]),
        wants('history')
          ? this.changes.listForNode(productId, nodeCode).catch(() => [])
          : Promise.resolve([]),
        wants('dependencies')
          ? this.trace.nodeRelations(productId, nodeCode, 'both').catch(() => [])
          : Promise.resolve([]),
        wants('history')
          ? this.trace.historyForNode(productId, nodeCode).catch(() => [])
          : Promise.resolve([]),
      ]);

    if (wants('functional')) {
      // La ficha es la fuente de verdad del objetivo/descripción (0008);
      // el documento vinculado (screen_desc/spec) aporta el detalle.
      const prefix = [
        node.objective ? `Objetivo: ${node.objective}` : '',
        node.description ? `Descripción: ${node.description}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');
      const functional =
        linkedDocs.find((d) => d.docTypeKey === 'screen_desc') ??
        linkedDocs.find((d) => d.docTypeKey === 'spec') ??
        linkedDocs[0];
      const body = (functional?.bodyMarkdown ?? '').slice(0, 4000);
      const composed = [prefix, body].filter(Boolean).join('\n\n');
      if (composed) {
        // Descripción funcional acotada a 4 KB (06 §6).
        base.functional = composed.slice(0, 4000);
      }
    }

    let anyTruncated = false;
    if (
      wants('docs') ||
      wants('rules') ||
      wants('useCases') ||
      wants('dataModel') ||
      wants('apiContracts') ||
      wants('decisions')
    ) {
      const pick = (keys: string[]) =>
        linkedDocs
          .filter((d) => keys.includes(d.docTypeKey))
          .map((d) => ({
            code: d.code ?? null,
            title: d.title,
            version: d.version,
            status: d.status,
            metadata: (d.metadata ?? {}) as Record<string, unknown>,
          }));
      if (wants('docs')) {
        const { items, truncated } = cap(
          pick([
            'spec',
            'screen_desc',
            'workflow',
            'tech_spec',
            'tech_manual',
            'test_doc',
            'data_model',
            'api_contract',
          ]),
        );
        if (items.length > 0) base.documents = items;
        anyTruncated = anyTruncated || truncated;
      }
      if (wants('rules')) {
        const rules = pick(['business_rule']).map((d) => ({
          code: d.code,
          title: d.title,
          condition: (d.metadata['condition'] as string | undefined) ?? null,
          action: (d.metadata['action'] as string | undefined) ?? null,
        }));
        if (rules.length > 0) base.businessRules = rules;
      }
      if (wants('useCases')) {
        const cases = pick(['use_case']).map((d) => ({
          code: d.code,
          title: d.title,
          actor: (d.metadata['actor'] as string | undefined) ?? null,
          goal: (d.metadata['goal'] as string | undefined) ?? null,
        }));
        if (cases.length > 0) base.useCases = cases;
      }
      if (wants('nfr')) {
        const items = pick(['req_non_functional']).map((d) => ({
          code: d.code,
          title: d.title,
          category: (d.metadata['category'] as string | undefined) ?? null,
          metric: (d.metadata['metric'] as string | undefined) ?? null,
          threshold: (d.metadata['threshold'] as string | undefined) ?? null,
        }));
        if (items.length > 0) base.nonFunctionalRequirements = items;
      }
      if (wants('dataModel')) {
        const models = pick(['data_model']).map((d) => ({ code: d.code, title: d.title }));
        if (models.length > 0) base.dataModel = models;
      }
      if (wants('apiContracts')) {
        const contracts = pick(['api_contract']).map((d) => ({ code: d.code, title: d.title }));
        if (contracts.length > 0) base.apiContracts = contracts;
      }
      if (wants('decisions')) {
        const decisions = pick(['adr']).map((d) => ({ code: d.code, title: d.title }));
        if (decisions.length > 0) base.decisions = decisions;
      }
    }

    if (wants('pendingTasks')) {
      // Solo no-terminales (pending): tasks ya viene con stateKey real.
      const pending = nodeTasks
        .filter((t) => t.stateKey !== 'done' && t.stateKey !== 'cancelled')
        .map((t) => ({
          code: t.code ?? null,
          title: t.title,
          stateKey: t.stateKey,
          priority: t.priority,
        }));
      const { items, truncated } = cap(pending);
      if (items.length > 0) base.pendingTasks = items;
      anyTruncated = anyTruncated || truncated;
    }

    if (wants('openIssues')) {
      const open = nodeIssues
        .filter((i) => i.stateKey !== 'resolved' && i.stateKey !== 'closed')
        .map((i) => ({
          code: i.code ?? null,
          title: i.title,
          severity: i.severity,
          stateKey: i.stateKey,
        }));
      const { items, truncated } = cap(open);
      if (items.length > 0) base.openIssues = items;
      anyTruncated = anyTruncated || truncated;
    }

    if (wants('dependencies')) {
      const deps = nodeRelations
        .filter((r) => r.relationType === 'depends_on')
        .map((r) => ({
          code: r.sourceKind === 'node' ? (r.sourceCode ?? null) : (r.targetCode ?? null),
          kind: r.sourceKind === 'node' ? r.targetKind : r.sourceKind,
          relation: r.relationType,
        }));
      const { items, truncated } = cap(deps);
      if (items.length > 0) base.dependencies = items;
      anyTruncated = anyTruncated || truncated;
    }

    if (wants('history')) {
      const recent = nodeHistory.slice(0, LIST_CAP).map((h) => ({
        at: h.at instanceof Date ? h.at.toISOString() : new Date(h.at).toISOString(),
        actorType: h.actorType,
        summary: String(h.summary).slice(0, 300),
      }));
      if (recent.length > 0) base.recentHistory = recent;
      void nodeChanges;
      void this.followup;
      void this.tests;
    }

    // Presupuesto total: si el JSON supera maxBytes, truncar functional.
    const serialized = JSON.stringify(base);
    if (Buffer.byteLength(serialized, 'utf8') > maxBytes) {
      if (base.functional) {
        const overflow = Buffer.byteLength(serialized, 'utf8') - maxBytes + 100;
        const cut = Math.max(0, base.functional.length - overflow);
        base.functional = base.functional.slice(0, cut);
        anyTruncated = true;
      }
      base.truncated = true;
      // Si tras truncar functional sigue excediendo, recortar documentos.
      if (Buffer.byteLength(JSON.stringify(base), 'utf8') > maxBytes && base.documents) {
        base.documents = base.documents.slice(0, Math.max(0, base.documents.length - 3));
        base.truncated = true;
      }
    } else if (anyTruncated) {
      base.truncated = true;
    }

    return base;
  }
}
