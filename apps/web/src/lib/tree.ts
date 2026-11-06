import type { TreeItem } from '@devcycle/ui';
import type { ProductNode } from './types';

type InternalNode = ProductNode & { children: InternalNode[] };

/**
 * Convierte la lista plana del endpoint GET /products/:slug/nodes (ordenada
 * por path) en el árbol anidado que consume @devcycle/ui.
 * - Huérfanos (parentId sin nodo en la lista) se adjuntan a la raíz.
 * - Orden por `position` en cada nivel.
 */
export function buildTree(nodes: ProductNode[]): TreeItem[] {
  const byId = new Map<string, InternalNode>();
  for (const node of nodes) {
    byId.set(node.id, { ...node, children: [] });
  }

  const roots: InternalNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const byPosition = (a: InternalNode, b: InternalNode) => a.position - b.position;
  const toItem = (node: InternalNode): TreeItem => ({
    id: node.id,
    label: node.name,
    code: node.code,
    ...(node.nodeType.color ? { typeColor: node.nodeType.color } : {}),
    ...(node.children.length > 0
      ? { children: [...node.children].sort(byPosition).map(toItem) }
      : {}),
  });

  return [...roots].sort(byPosition).map(toItem);
}

export interface ModuleProgress {
  id: string;
  code: string;
  name: string;
  total: number;
  done: number;
  pct: number;
}

/**
 * Avance real por módulo (tipo `modulo`): % de nodos descendientes con
 * status === 'done'. Módulos sin descendientes → 0%.
 */
export function computeModuleProgress(nodes: ProductNode[]): ModuleProgress[] {
  const childrenOf = new Map<string, ProductNode[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const siblings = childrenOf.get(node.parentId) ?? [];
    siblings.push(node);
    childrenOf.set(node.parentId, siblings);
  }

  const descendants = (rootId: string): ProductNode[] => {
    const result: ProductNode[] = [];
    const stack = [...(childrenOf.get(rootId) ?? [])];
    while (stack.length > 0) {
      const current = stack.pop()!;
      result.push(current);
      stack.push(...(childrenOf.get(current.id) ?? []));
    }
    return result;
  };

  return nodes
    .filter((node) => node.nodeType.key === 'modulo')
    .map((node) => {
      const subtree = descendants(node.id);
      const done = subtree.filter((candidate) => candidate.status === 'done').length;
      const total = subtree.length;
      return {
        id: node.id,
        code: node.code,
        name: node.name,
        total,
        done,
        pct: total === 0 ? 0 : Math.round((done / total) * 100),
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}
