# GA360 x DAB — Integração de Verbas

## Objetivo

Documentar, de forma operacional, como o GA360 deve consultar os endpoints de verbas no Data API Builder (DAB).

> **Atualização 2026-03-18:** Novo endpoint `verbas-ga360` (formato LONG) criado para resolver os 7 problemas de integração (P1–P7) documentados no PRD. O endpoint `verbas` (formato PIVOT) continua disponível como legado.

---

## Endpoints disponíveis

| Endpoint | View | Formato | Uso |
|----------|------|---------|-----|
| `GET /v1/verbas-ga360` | `dbo.vw_verbas_long_api` | **LONG** (1 linha por cpf×mês×evento) | **GA360 — usar este** |
| `GET /v1/verbas` | `dbo.vw_verbas_api` | PIVOT (12 colunas mensais) | Legado / outros consumidores |

---

## NOVO: Endpoint `verbas-ga360` (formato LONG)

### Contrato de campos (alinhado com PRD seção 5)

| Campo | Tipo | Obrigatório | Exemplo | Descrição |
|-------|------|:-----------:|---------|-----------|
| `id_verba_long` | varchar(64) | PK | `A1B2C3...` | Hash SHA2_256 (cnpj\|cpf\|ano\|mes\|cod_evento) |
| `cpf` | varchar(11) | ✅ | `"12345678901"` | CPF do funcionário, apenas dígitos |
| `nome_funcionario` | varchar(60) | ✅ | `"JOAO DA SILVA"` | Nome completo |
| `cnpj_empresa` | varchar(14) | ✅ | `"53113791000122"` | CNPJ da empresa, 14 dígitos |
| `razao_social` | varchar(40) | ✅ | `"CHOK DISTRIBUIDORA..."` | Razão social da empresa |
| `tenant_id` | computed | ✅ | `"CHOK_DISTRIBUIDORA_DE_ALIMENTOS_LTDA"` | Razão social normalizada |
| `ano` | smallint | ✅ | `2026` | Ano de referência |
| `mes` | tinyint | ✅ | `3` | Mês de referência (1–12) |
| `cod_evento` | int | ✅ | `1` | Código da rubrica/evento salarial |
| `nome_evento` | varchar(100) | ✅ | `"SALARIO MENSAL"` | Descrição do evento |
| `valor` | decimal(18,2) | ✅ | `4500.00` | Valor monetário |
| `tipo_verba` | computed | ✅ | `"SALDO_SALARIO"` | Categoria inferida do cod_evento |
| `competencia` | computed | ✅ | `"2026-03"` | Período YYYY-MM |

### Exemplo de response

```json
{
  "value": [
    {
      "id_verba_long": "A1B2C3D4...",
      "cpf": "12345678901",
      "nome_funcionario": "JOAO CARLOS DA SILVA",
      "cnpj_empresa": "53113791000122",
      "razao_social": "CHOK DISTRIBUIDORA DE ALIMENTOS LTDA",
      "tenant_id": "CHOK_DISTRIBUIDORA_DE_ALIMENTOS_LTDA",
      "ano": 2026,
      "mes": 3,
      "cod_evento": 1,
      "nome_evento": "SALARIO MENSAL",
      "valor": 4500.00,
      "tipo_verba": "SALDO_SALARIO",
      "competencia": "2026-03"
    }
  ],
  "nextLink": "https://api.grupoarantes.emp.br/v1/verbas-ga360?$filter=..."
}
```

### Filtros obrigatórios

> **CRÍTICO:** Sempre use `$filter=ano eq <ANO>` — sem ele, full scan → timeout.

| Filtro | Obrigatoriedade | Impacto |
|--------|----------------|---------|
| `ano eq 2026` | **Obrigatório** | Reduz escopo para 1 ano |
| `ano eq 2026 and mes eq 3` | Recomendado | Sync parcial por mês |
| `tenant_id eq 'EMPRESA_X'` | Recomendado | Reduz para 1 empresa |

### Exemplos de chamada

**Sync completo de ano (padrão GA360):**

```bash
curl -i "https://api.grupoarantes.emp.br/v1/verbas-ga360?\$filter=ano%20eq%202026&\$first=5000" \
  -H "X-API-Key: <API_KEY>" \
  -H "Accept: application/json"
```

**Sync parcial por mês:**

```bash
curl -i "https://api.grupoarantes.emp.br/v1/verbas-ga360?\$filter=ano%20eq%202026%20and%20mes%20eq%203&\$first=5000" \
  -H "X-API-Key: <API_KEY>" \
  -H "Accept: application/json"
```

**Filtro por empresa:**

```bash
curl -i "https://api.grupoarantes.emp.br/v1/verbas-ga360?\$filter=ano%20eq%202026%20and%20tenant_id%20eq%20'CHOK_DISTRIBUIDORA_DE_ALIMENTOS_LTDA'&\$first=5000" \
  -H "X-API-Key: <API_KEY>" \
  -H "Accept: application/json"
```

### Pseudocódigo de sync (GA360)

```ts
async function syncVerbas(baseUrl: string, apiKey: string, ano: number, mes?: number, tenantId?: string, first = 5000) {
  const headers = { 'X-API-Key': apiKey, 'Accept': 'application/json' };

  let filter = `ano eq ${ano}`;
  if (mes) filter += ` and mes eq ${mes}`;
  if (tenantId) filter += ` and tenant_id eq '${tenantId}'`;

  let url = `${baseUrl}/verbas-ga360?$filter=${encodeURIComponent(filter)}&$first=${first}`;

  while (url) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`DAB ${res.status}: ${await res.text()}`);

    const payload = await res.json();
    const rows = payload.value ?? [];

    // Cada row tem: cpf, cnpj_empresa, ano, mes, cod_evento, tipo_verba, valor
    // GA360 pode agrupar por (cpf, tipo_verba, ano) e pivotar meses internamente
    await persistToStaging(rows);

    // nextLink agora é ABSOLUTO — usar diretamente
    url = payload.nextLink || '';
  }
}
```

### Metas de performance

| Cenário | Volume estimado | Meta |
|---------|-----------------|------|
| Sync ano + filtro `$first=5000` | ~50.000 registros | **< 15s** |
| Sync mês específico | ~4.000 registros | **< 3s** |
| Sync ano + tenant_id | ~25.000 registros | **< 5s** |

### Problemas resolvidos (P1–P7)

| # | Problema | Status | Como |
|---|---------|--------|------|
| P1 | Full scan sem índice | ✅ Resolvido | View LONG lê de `gold.vw_pagamento_verba_sankhya` (já filtrado por dim_calendario) |
| P2 | Filtro ano lento | ✅ Resolvido | Novos índices em dim_funcionario e dim_empresa |
| P3 | nextLink relativo | ✅ Resolvido | `next-link-relative: false` no dab-config.json |
| P4 | Página limitada | ✅ Resolvido | `max-page-size: 100000` — usar `$first=5000` |
| P5 | Falta cnpj_empresa | ✅ Resolvido | JOIN com `silver.dim_empresa` na view |
| P6 | Falta tipo_verba | ✅ Resolvido | CASE expression sobre cod_evento na view |
| P7 | Nomes inconsistentes | ✅ Resolvido | Nomes padronizados conforme PRD seção 5 |

---

## LEGADO: Endpoint `verbas` (formato PIVOT)

> Este endpoint continua disponível mas **não é recomendado para o GA360**. Use `verbas-ga360` acima.

### Causa raiz do erro original no GA360

O cliente estava chamando rota de item no formato **chave implícita**: `GET /v1/verbas/{valor}`. No DAB, esse formato retorna 400 com `implicit primary key`.

---

## Diagnóstico consolidado

### Serviços

- DAB local: online (`/api/health` retornando 200)
- IIS público: online e protegido por `X-API-Key`
- Endpoint público `/v1/health`:
  - sem chave: 401 (esperado)
  - com chave: 200

### Causa raiz do erro no GA360

O cliente está chamando rota de item no formato **chave implícita**:

- `GET /v1/verbas/{valor}`

No DAB em uso, esse formato não é suportado para esse endpoint e retorna 400 com a mensagem de `implicit primary key`.

---

## Contrato da API `verbas`

## Base URLs

- Externa (produção): `https://api.grupoarantes.emp.br/v1`
- Interna (upstream DAB): `http://localhost:5000/api`

## Autenticação

Obrigatória no endpoint público:

- Header: `X-API-Key: <sua-chave>`
- Recomendado também enviar: `Accept: application/json`

## Entidade

- Nome REST: `verbas`
- Fonte no DAB: `dbo.vw_verbas_api`
- Chave configurada: `id_verba`

---

## Formatos de URL suportados e não suportados

### ✅ Suportado (coleção)

- `GET /v1/verbas`
- `GET /v1/verbas?$first=100`

### ✅ Suportado (item com chave explícita)

- `GET /v1/verbas/id_verba/{id_verba}`

Exemplo real validado:

- `GET /api/verbas/id_verba/0002FF3CC7F9BDB7CFEB4B3E6AC52C027616DB9957B650E801BDFD2330772DC2`

### ❌ Não suportado (gera erro 400)

- `GET /v1/verbas/{id}`

Erro esperado:

```json
{
  "error": {
    "code": "BadRequest",
    "message": "Support for url template with implicit primary key field names is not yet added.",
    "status": 400
  }
}
```

---

## Paginação

Configuração atual do DAB:

- `default-page-size`: 100
- `max-page-size`: 100000

### Recomendação de consumo

1. Começar com `?$first=<pageSize>`
2. Ler `value`
3. Se vier `nextLink`, seguir até finalizar

---

## Campos principais retornados por `verbas`

Campos observados na resposta:

- `id_verba` (chave técnica para rota de item)
- `tenant_id` (empresa em formato `RAZAO_SOCIAL_NORMALIZADA` — use para filtrar por empresa)
- `razao_social`
- `cpf`
- `nome_funcionario`
- `tipo_verba`
- `ano`
- colunas mensais: `Janeiro`, `Fevereiro`, `Marco`, `Abril`, `Maio`, `Junho`, `Julho`, `Agosto`, `Setembro`, `Outubro`, `Novembro`, `Dezembro`

> Observação: usar `id_verba` apenas como identificador técnico de API. Não inferir regra de negócio a partir do hash.

---

## Filtros obrigatórios e recomendados

> **IMPORTANTE — Performance:** sem filtro de `ano`, o endpoint faz full scan em toda a tabela de verbas (lento, pode ultrapassar 30s). Sempre use `$filter=ano eq <ANO>` como mínimo.

| Filtro | Obrigatoriedade | Impacto |
|--------|----------------|---------|
| `ano eq 2025` | **Obrigatório** | Reduz escopo para 1 ano, usa índice no dim_calendario |
| `tenant_id eq 'EMPRESA_X'` | Recomendado | Reduz para 1 empresa, evita dados cross-tenant |

### Valores válidos de `tenant_id` (validados em 2026-03-16)

| tenant_id | razao_social |
|-----------|-------------|
| `CHOK_DISTRIBUIDORA_DE_ALIMENTOS_LTDA` | CHOK DISTRIBUIDORA DE ALIMENTOS LTDA |
| `CHOKDOCE_COMERCIO_DE_PRODUTOS_ALIM_LTDA` | CHOKDOCE COMERCIO DE PRODUTOS ALIM LTDA |

### Como descobrir os valores válidos de `tenant_id`

```bash
curl -s "https://api.grupoarantes.emp.br/v1/verbas?$first=100&$select=tenant_id,razao_social" \
  -H "X-API-Key: <API_KEY>" | jq '[.value[] | {tenant_id, razao_social}] | unique'
```

---

## Exemplos prontos de chamada

## 1) Health público

```bash
curl -i "https://api.grupoarantes.emp.br/v1/health" \
  -H "X-API-Key: <API_KEY>" \
  -H "Accept: application/json"
```

## 2) Listar verbas com filtro de ano (RECOMENDADO)

```bash
curl -i "https://api.grupoarantes.emp.br/v1/verbas?\$filter=ano%20eq%202025&\$first=1000" \
  -H "X-API-Key: <API_KEY>" \
  -H "Accept: application/json"
```

## 3) Listar verbas com ano + empresa (IDEAL para multi-tenant)

```bash
curl -i "https://api.grupoarantes.emp.br/v1/verbas?\$filter=ano%20eq%202026%20and%20tenant_id%20eq%20'CHOK_DISTRIBUIDORA_DE_ALIMENTOS_LTDA'&\$first=1000" \
  -H "X-API-Key: <API_KEY>" \
  -H "Accept: application/json"
```

## 4) Buscar item por chave explícita

```bash
curl -i "https://api.grupoarantes.emp.br/v1/verbas/id_verba/<ID_VERBA>" \
  -H "X-API-Key: <API_KEY>" \
  -H "Accept: application/json"
```

---

## Implementação recomendada no GA360 (`sync-verbas`)

## Estratégia de rota

### Fluxo para sincronização (coleção)

1. Tentar `GET /v1/verbas?$filter=ano eq <ANO>&$first=<N>` — **sempre com filtro de ano**
2. Se 200, processar `value` e seguir `nextLink`
3. Se 401, tratar autenticação/chave
4. Se 5xx, aplicar retry exponencial

### Fluxo para detalhe (quando necessário)

- **Não usar** `/v1/verbas/{id}`
- Usar exclusivamente `/v1/verbas/id_verba/{id_verba}`

## Pseudocódigo resiliente

```ts
async function syncVerbas(baseUrl: string, apiKey: string, ano: number, tenantId?: string, first = 1000) {
  const headers = {
    'X-API-Key': apiKey,
    'Accept': 'application/json'
  };

  // Filtro de ano é OBRIGATÓRIO — sem ele a query faz full scan (lento)
  let filter = `ano eq ${ano}`;
  if (tenantId) {
    filter += ` and tenant_id eq '${tenantId}'`;
  }

  let url = `${baseUrl}/verbas?$filter=${encodeURIComponent(filter)}&$first=${first}`;

  while (url) {
    const res = await fetch(url, { headers });

    if (res.status === 401) {
      throw new Error('DAB Unauthorized: valide X-API-Key');
    }

    if (res.status >= 500) {
      throw new Error(`DAB ${res.status}: falha transitória`);
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`DAB ${res.status}: ${body}`);
    }

    const payload = await res.json();
    const rows = payload.value ?? [];

    // persistir rows no GA360
    await persist(rows);

    url = payload.nextLink ? new URL(payload.nextLink, baseUrl).toString() : '';
  }
}

async function getVerbaById(baseUrl: string, apiKey: string, idVerba: string) {
  const url = `${baseUrl}/verbas/id_verba/${encodeURIComponent(idVerba)}`;
  const res = await fetch(url, {
    headers: {
      'X-API-Key': apiKey,
      'Accept': 'application/json'
    }
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`DAB ${res.status}: ${await res.text()}`);
  }

  const payload = await res.json();
  return payload.value?.[0] ?? null;
}
```

---

## Tratamento de erros (playbook)

### 400 + `implicit primary key`

- Causa: uso de `/verbas/{id}`
- Ação: trocar para `/verbas/id_verba/{id}`

### 401

- Causa: ausência/chave inválida no IIS
- Ação: revisar `X-API-Key`

### 404 em item

- Causa: `id_verba` não encontrado
- Ação: tratar como "sem registro"

### 500

- Causa: erro interno/transitório
- Ação: retry exponencial com limite e observabilidade

---

## Checklist de homologação GA360

- [ ] `GET /v1/health` com `X-API-Key` retorna 200
- [ ] `GET /v1/verbas?$filter=ano eq 2025&$first=1` retorna 200 em < 5s
- [ ] `id_verba` e `tenant_id` presentes nos itens retornados
- [ ] `GET /v1/verbas/id_verba/{id}` retorna 200 para id válido
- [ ] Nenhuma chamada usando `/v1/verbas/{id}`
- [ ] Todas as chamadas de sync usam `$filter=ano eq <ANO>` (nunca full scan)
- [ ] Retry implementado para 5xx

---

## Observações finais

- O backend DAB está operacional com dois endpoints de verbas: `verbas-ga360` (LONG, recomendado) e `verbas` (PIVOT, legado).
- `nextLink` agora retorna URL **absoluta** em todos os endpoints.
- `cnpj_empresa` disponível no endpoint LONG para match direto com tabela `companies` do GA360.
- `tipo_verba` mapeado automaticamente via `cod_evento` — novos eventos não mapeados caem em `OUTROS`.
- Para diagnosticar performance:
  - Endpoint LONG: `scripts\_test_verbas_ga360.ps1` e `scripts\_dba_verbas_long_optimize.ps1`
  - Endpoint PIVOT (legado): `scripts\_test_verbas.ps1` e `scripts\_dba_verbas_optimize.ps1`
- Configuração no GA360: atualizar `dl_queries` para apontar para `/v1/verbas-ga360` (ou `/api/verbas-ga360` se upstream direto).
