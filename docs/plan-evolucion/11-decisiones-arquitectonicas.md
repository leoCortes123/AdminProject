# 11 · Decisiones arquitectónicas

## D-E1 · Mantener metadata JSONB para documentos funcionales (no tablas dedicadas)
- Contexto: ADR-008 ya adoptado.
- Problema: evitar duplicar infraestructura de versionado/relaciones.
- Alternativas: tablas dedicadas (descartada).
- Decisión: mantener JSONB + Zod.
- Consecuencias: consultabilidad vía GIN; sin FK por campo.
- Estado: Aprobada (implementada).

## D-E2 · Ampliar `relations` incrementalmente, no reemplazar
- Contexto: tabla existente funcional.
- Problema: tipos insuficientes.
- Decisión: ampliar CHECK + triggers; soft delete.
- Estado: Propuesta.

## D-E3 · Motor de impacto en PostgreSQL + aplicación, no grafo externo
- Contexto: prompt exige PostgreSQL como fuente de verdad.
- Problema: consultas transitivas.
- Decisión: BFS/CTE en Postgres; no Neo4j.
- Estado: Propuesta.

## D-E4 · Flujos como documentos estructurados, no BPM
- Contexto: no convertir DevCycle en BPM.
- Decisión: metadata JSONB con steps/decisions/transitions; sin motor de ejecución.
- Estado: Propuesta.

## D-E5 · Escrituras de agentes con confirmación humana
- Contexto: seguridad.
- Decisión: scopes explícitos; `agent:confirm` nunca por token.
- Estado: Propuesta.

## Decisiones que requieren aprobación antes de iniciar desarrollo
1. Subset exacto de nuevos tipos de relación (D-E2).
2. Estructura final de `change_impact_assessments` (D-E3).
3. Ampliación de `flowMetadataSchema` (D-E4).
4. Alcance de escrituras MCP (D-E5).
5. Si se agregan nuevos tipos documentales (03 §2).
