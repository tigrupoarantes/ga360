# VERBAS - Operação de Sincronização (RH/Financeiro)

## Objetivo
Garantir sincronização confiável entre VERBAS e base de funcionários com reconciliação completa:
- `merge` (consolidação de duplicados),
- `update/insert` (`upsert`),
- `delete` por escopo (ano/mês) para remover sobras.

## Payload recomendado (produção)
Endpoint: `POST /functions/v1/sync-verbas`

```json
{
  "source_system": "gestao_ativos",
  "company_id": "<UUID_DA_EMPRESA>",
  "department": "Comercial",
  "position": "Vendedor",
  "load_from_datalake": true,
  "target_year": 2026,
  "target_month": 2,
  "replace_scope": true,
  "max_pages": 25
}
```

## Regras de reconciliação
- `replace_scope=true` + `target_year`:
  - apaga dados existentes no escopo (empresa/ano e opcional mês),
  - insere estado atual vindo da origem.
- Para fechamento mensal, sempre informar `target_year` e `target_month`.
- Para fechamento anual, informar apenas `target_year`.

## Estratégia operacional (melhor prática)
1. Rodar sincronização por empresa e mês fechado.
2. Validar contagem de registros e falhas (`failure_reasons`).
3. Reprocessar somente filtros com falha (cargo/departamento) quando necessário.
4. Publicar dashboard com cortes: empresa, setor, cargo, colaborador.

## KPIs executivos recomendados (CEO/RH)
- Desvio salarial por cargo (funcionário vs média do cargo na mesma empresa).
- Crescimento mês a mês e ano contra ano por cargo.
- Dispersão salarial (P25/P50/P75) por cargo/departamento.
- Percentual de outliers remuneratórios (> 2 desvios-padrão).
- Tendência de compressão salarial (novos x antigos no mesmo cargo).

## Governança e compliance
- Dados pessoais mascarados para perfis sem acesso completo.
- Trilhas de execução em `dl_query_runs` para auditoria.
- Revisão mensal de permissões e segregação de acesso por papel.
