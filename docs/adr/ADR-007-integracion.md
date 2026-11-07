# ADR-007 · Fase 6a: API de integración read-only con service tokens

- **Estado:** ✅ Aceptada (Fase 6a)
- **Fecha:** 2026-11-07
- **Relacionado:** [06-integraciones-agentes.md](../planificacion/06-integraciones-agentes.md) §2/§8/§10 · [07-plan-implementacion.md](../planificacion/07-plan-implementacion.md) §7 (F6a-T01…T03)

## Contexto

Las Fases 1–5 dejaron un monolito modular NestJS con dominio completo (productos, árbol ltree, docs versionadas, trabajo, traza, seguimiento) y auditoría humana. La Fase 6 abre la puerta a agentes externos (Claude Code primero) sin darles acceso a PostgreSQL ni a la sesión web. El plan subdivide la Fase 6 en 6a–6d; esta ADR documenta solo 6a: API de integración + scopes + auditoría, como base de 6b (MCP read-only).

## Decisión

1. **Service accounts por producto + api_tokens con hash sha256.** Un token `dvc_<32 bytes base64url>` se muestra una sola vez; en BD solo vive `sha256`. Revocación instantánea (`revoked_at` chequeado en cada request) y expiración opcional. `agent:confirm` nunca otorgable por token.
2. **Scopes por endpoint** (`read:products`, `read:structure`, `read:docs`, `read:tasks`, `read:issues`, `read:changes`, `read:tests`, `read:trace`, `read:search` en 6a). Tokens sin scopes = solo lectura por defecto. El `:slug` de la ruta debe ser el producto del token (tenant-escape), igual que `ProductGuard` para humanos.
3. **Endpoints `/integration/*` read-only reutilizando servicios de dominio.** Sin lógica duplicada: `ProductsService`, `NodesService`, `DocumentsService`, `TasksService`, `IssuesService`, `ChangesService`, `TestCasesService`, `TraceService`, `FollowupService`, `SearchService`. Forma estable para MCP (`list_products`, `get_product`, `get_product_structure`, `get_node`, `get_product_context`, `list_documents`, `get_document`, `get_document_history`, `list_tasks`, `get_task`, `list_issues`, `get_issue`, `get_node_history`, `get_node_relations`, `get_dependencies`, `list_changes`, `get_change`, `list_test_cases`, `get_test_case`, `search_product_knowledge`, `get_product_overview`).
4. **Auth por Bearer sin sesión web** (`@Public()` + `IntegrationTokenGuard`). La gestión humana de tokens sigue con sesión + `integrations:manage` (`POST /products/:slug/integration/...`).
5. **`get_product_context` con presupuesto 32 KB** (secciones `functional,docs,rules,useCases,dataModel,apiContracts,pendingTasks,openIssues,decisions,dependencies,history`, listas capadas a 10, `functional` ≤ 4 KB, `truncated: true`).
6. **Auditoría doble:** `agent_executions` (args redactados, sin secretos ni cuerpos) + `activity_log` con `actor_type='agent'` y `actor_service_account_id`. Fallos de auditoría no rompen la respuesta.
7. **Rate-limit en memoria por token** (120 req/min lectura, versión 6a). La gestión de tokens se expone en la UI (`/integraciones`) con creación en un click y revocación visible.

## Alternativas evaluadas

| Alternativa                       | A favor             | En contra                                                                                                | Veredicto                                          |
| --------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Sesiones better-auth para agentes | Reutiliza guards    | Sesión web≠identidad de agente; permisos humanos excesivos; difícil revocar por agente; contradice 06 §2 | Descartada                                         |
| Tokens JWT firmados stateless     | Sin lookup DB       | Revocación no instantánea; expiración larga; no audita por cuenta                                        | Descartada (hash + lookup)                         |
| MCP dentro de `apps/api` (`/mcp`) | Un contenedor menos | Acopla churn del SDK MCP; fallo tumba la web; sin binario ejecutable                                     | Descartada (servidor separado en 6b)               |
| Write scopes desde 6a             | Adelanta MCP v2     | Superficie de ataque sin confirmación humana (6c)                                                        | Descartada (lectura por defecto, escrituras en 6c) |
| Rate-limit en Redis               | Distribuido         | Infra extra sin necesidad en v1 (1 réplica API)                                                          | Descartada (en memoria, Redis si escala)           |

## Consecuencias

- Migración `0007_integration`: `service_accounts`, `api_tokens`, `agent_executions` enriquecida (`request_args`, `result_summary`, `ip`), `activity_log.actor_service_account_id`.
- API nueva: `/integration/*` (Bearer) + `/products/:slug/integration/*` (sesión). OpenAPI `integration-v1` en `/api/v1/docs/integration`.
- UI: `/products/[slug]/integraciones` (crear cuenta/token, revocar, auditoría con badge AGENTE IA). Sidebar «Integraciones y agentes», footer `v0.6 · Fase 6a`.
- 6b (MCP stdio) consumirá esta API tal cual; 6c añadirá escrituras con confirmación; 6d webhook Git.
