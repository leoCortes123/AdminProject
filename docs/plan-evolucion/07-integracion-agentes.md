# 07 · Integración con agentes de IA

## 1. Estado actual

- API read-only `/integration/*` con Bearer tokens y scopes.
- MCP 23 tools read-only (lista en `apps/mcp-server/src/tools.ts`).
- Contexto empaquetado `get_product_context` (32 KB).
- Auditoría doble `agent_executions` + `activity_log`.
- Scopes de escritura declarados en `packages/shared/src/constants.ts` pero sin endpoints.

## 2. Operaciones necesarias (prompt)

| Operación | Estado | Recomendación |
|---|---|---|
| `get_product_structure` | Implementado (MCP) | Mantener |
| `get_node_context` | Parcial (`get_product_context`) | Mantener; ampliar con impacto |
| `get_related_items` | Parcial (`get_node_relations`, `get_dependencies`) | Mantener |
| `get_use_case` | No dedicado (documento) | Consulta interna vía `get_document` + metadata |
| `get_workflow` | No dedicado | Consulta interna vía `get_document` |
| `get_business_rules` | No dedicado | Consulta interna |
| `get_requirements` | No dedicado | Consulta interna |
| `analyze_impact` | No implementado | Nueva tool + endpoint (fase 3) |
| `get_related_tests` | Parcial (`list_test_cases` por nodo) | Mantener |
| `create_change` | No implementado (escritura) | Nueva tool con confirmación (fase 4) |
| `update_document` | No implementado (escritura) | Nueva tool con confirmación (fase 4) |
| `register_test_result` | No implementado (escritura) | Nueva tool con confirmación (fase 4) |

**Decisión**: no crear tools duplicadas; reutilizar `get_document`/`list_documents` para CU/reglas/requisitos/flujos, y añadir solo `analyze_impact` + escrituras controladas.

## 3. Permisos

- Lectura: scopes `read:*` (ya).
- Escritura: scopes `write:*`, `changes:propose`, `issues:resolve`, nunca `agent:confirm` otorgable por token (solo humano).
- Operaciones sensibles requieren confirmación humana (`requires_confirmation`).

## 4. Auditoría

- `agent_executions`: args redactados, result_summary, duration, ip.
- `activity_log`: actor_type='agent', actor_service_account_id.
- Fallos de auditoría no rompen respuesta.

## 5. Prevención de invenciones

- Exigir identificadores verificables (código/UUID).
- Referencias a documentos consultados en respuestas.
- No permitir crear relaciones sin validar extremos.

## 6. Diseño de `analyze_impact` (MCP)

Entrada: `productSlug`, `entityKind`, `entityCode|Id`, `depth?`, `relationTypes?`.  
Salida: `{confirmed, probable, review, tests, documents, modules}`.  
Read-only en primera versión.

## 7. Diseño de escrituras (fase posterior)

- `update_document`: requiere `write:docs` + `docs:write` efectivo; optimistic locking por `expectedVersion`.
- `create_change`: requiere `changes:propose`; estado inicial `proposed`.
- `register_test_result`: requiere `write:tests`; append-only.

Todas con confirmación humana para operaciones sensibles y auditoría completa.

## 8. No hacer

- No dar a agentes acceso directo a PostgreSQL.
- No crear MCP dentro de API.
- No otorgar `agent:confirm` a tokens.
