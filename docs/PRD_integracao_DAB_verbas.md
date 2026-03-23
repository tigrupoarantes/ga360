# Technical Integration Brief — GA 360 × DAB: Sincronização de Verbas

**Versão:** 1.0
**Data:** 2026-03-18
**Destinatário:** Equipe DAB (Datalake / API Backend)
**Autor:** GA 360 — Grupo Arantes

---

## 1. Visão Geral da Integração

### 1.1 Propósito

O GA 360 é o portal corporativo de gestão estratégica do Grupo Arantes. Um de seus módulos é
o **Card de Verbas** (Governança EC / Pessoas & Cultura), que exibe e consolida os dados de
verbas salariais de todos os funcionários das empresas do grupo.

Os dados de origem estão no DAB (Datalake / SQL Server), exposto via API OData. O GA 360
consome essa API periodicamente para sincronizar os registros para seu banco interno
(Supabase / PostgreSQL), onde os dados são agregados, filtrados e exibidos no portal com
controle de acesso por empresa, departamento e cargo.

### 1.2 Atores

| Ator | Responsabilidade |
|------|-----------------|
| **GA 360 Frontend** | Interface do usuário — dispara sincronizações, exibe dados agregados |
| **GA 360 Edge Functions** | Backend serverless (Deno/Supabase) — orquestra chamadas à API DAB |
| **DAB API** | Fonte de dados — expõe verbas via HTTP/OData |
| **Supabase (PostgreSQL)** | Banco interno do GA 360 — armazena dados sincronizados |
| **Usuário final** | Analistas de RH / Diretoria — consultam dados no portal |

### 1.3 Fluxo End-to-End

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           GA 360 — Frontend                              │
│  Usuário clica "Sincronizar"  →  polling de status a cada 3s             │
└──────────────────────────┬───────────────────────────────────────────────┘
                           │ POST /functions/v1/verbas-secure-query
                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   Edge Function: verbas-secure-query                     │
│  1. Valida JWT + permissões do usuário                                   │
│  2. Cria registro de job (verbas_sync_jobs, status=queued)               │
│  3. Dispara sync-verbas com timeout de 8s (fire-and-forget)              │
│  4. Retorna { job_id } ao frontend para polling                          │
└──────────────────────────┬───────────────────────────────────────────────┘
                           │ POST /functions/v1/sync-verbas (background)
                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   Edge Function: sync-verbas (até 150s)                  │
│  1. Lê configuração de conexão (dl_connections + dl_queries)             │
│  2. Monta URL com $filter=ano eq {ANO}  ← CRÍTICO PARA PERFORMANCE      │
│  3. GET paginado na DAB API (segue @odata.nextLink até esgotar)          │
│  4. Valida registros recebidos (CPF, ano, mes, cod_evento, valor)        │
│  5. Agrega: long format → pivot (1 linha/cpf×tipo_verba×ano, 12 meses)  │
│  6. Upsert em payroll_verba_staging (sem company_id ainda)               │
│  7. Chama apply_payroll_staging() — JOIN com external_employees          │
│  8. Atualiza job: status=done, métricas                                  │
└──────────────────────────┬───────────────────────────────────────────────┘
                           │ HTTP GET OData
                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                            DAB API                                       │
│  GET /api/verbas?$filter=ano eq 2026&$first=5000                         │
│  Retorna JSON com array value[] + @odata.nextLink para paginação         │
└──────────────────────────────────────────────────────────────────────────┘
                           │ dados sincronizados
                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        Supabase (PostgreSQL)                             │
│  payroll_verba_staging  →  apply_payroll_staging()  →  payroll_verba_pivot │
│  Frontend consulta payroll_verba_pivot (0 chamadas ao DAB na leitura)    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Arquitetura Interna do GA 360

### 2.1 Tabelas Envolvidas

| Tabela | Propósito | Chave única |
|--------|-----------|-------------|
| `dl_connections` | Configuração da conexão DAB (base_url, auth, headers) | id |
| `dl_queries` | Endpoints configurados por connection (endpoint_path, method) | id |
| `payroll_verba_staging` | Tabela intermediária — dados do DAB sem company_id | `(cpf, tipo_verba, ano)` |
| `payroll_verba_pivot` | Tabela final consultada pelo frontend — com company_id, 12 colunas mensais | `(company_id, cpf, tipo_verba, ano)` |
| `verbas_sync_jobs` | Rastreamento assíncrono do job (status, pages_fetched, records_received) | id |

### 2.2 Estrutura da `payroll_verba_pivot` (tabela consultada pelo frontend)

```sql
company_id                UUID    -- empresa resolvida via CPF
razao_social              TEXT    -- nome da empresa
cpf                       TEXT    -- CPF normalizado (apenas dígitos)
nome_funcionario          TEXT
tipo_verba                TEXT    -- ex: SALDO_SALARIO, BONUS, VERBA_INDENIZATORIA
ano                       INTEGER
janeiro ... dezembro      NUMERIC -- 12 colunas com valores mensais acumulados
employee_department       TEXT    -- enriquecido via external_employees
employee_position         TEXT
employee_unidade          TEXT
employee_accounting_group TEXT
```

### 2.3 Por que a tabela é no formato pivot (e não long format)

O DAB retorna em **long format**: 1 linha por funcionário × mês × rubrica (cod_evento).
Para um ano completo com ~300 funcionários e 15 rubricas/mês, isso resulta em
**~54.000 linhas** (`300 × 12 meses × 15 rubricas`).

O GA 360 consolida isso em **~4.500 linhas** na `payroll_verba_pivot`:
`300 funcionários × 15 tipos_verba × 1 linha/ano` (com valores jan–dez como colunas).

Isso reduz em **12x** o volume de dados na consulta do frontend e permite filtros
e agregações sem processar milhares de linhas.

---

## 3. Contrato de API — O que o GA 360 Envia e Espera Receber

### 3.1 Requisição HTTP

```
GET {base_url}/{endpoint_path}?$filter=ano eq 2026&$first=5000
Authorization: Bearer {token}
Accept: application/json
```

**Autenticação suportada:**
- `Authorization: Bearer {token}` (padrão)
- Header customizado, ex: `X-API-Key: {chave}` (configurável via AdminDatalake)

### 3.2 Parâmetros OData Utilizados

| Parâmetro | Exemplo | Criticidade | Descrição |
|-----------|---------|-------------|-----------|
| `$filter=ano eq {N}` | `$filter=ano eq 2026` | 🔴 **Crítico** | Filtra por ano de referência. Sem isso: full scan → timeout >30s |
| `$filter=ano eq {N} and mes eq {M}` | `$filter=ano eq 2026 and mes eq 3` | 🟡 Importante | Sync parcial por mês específico |
| `$first={N}` | `$first=5000` | 🟡 Importante | Tamanho da página. GA 360 solicita até 5.000 registros/página |
| `@odata.nextLink` | _(no response)_ | 🔴 **Crítico** | GA 360 segue nextLink automaticamente até não haver mais páginas |
| `$select={campos}` | `$select=cpf,nome,ano,mes,valor` | 🟢 Desejável | Reduz payload retornando apenas campos necessários |

### 3.3 Schema do Response Esperado

```json
{
  "value": [
    {
      "cpf":              "12345678901",
      "nome_funcionario": "JOAO DA SILVA",
      "cnpj_empresa":     "53113791000122",
      "razao_social":     "CHOK DISTRIBUIDORA LTDA",
      "ano":              2026,
      "mes":              3,
      "cod_evento":       1,
      "valor":            4500.00,
      "tipo_verba":       "SALDO_SALARIO",
      "competencia":      "2026-03"
    },
    {
      "cpf":              "12345678901",
      "nome_funcionario": "JOAO DA SILVA",
      "cnpj_empresa":     "53113791000122",
      "razao_social":     "CHOK DISTRIBUIDORA LTDA",
      "ano":              2026,
      "mes":              3,
      "cod_evento":       10000,
      "valor":            1200.00,
      "tipo_verba":       "VERBA_INDENIZATORIA",
      "competencia":      "2026-03"
    }
  ],
  "@odata.nextLink": "https://dab.grupoxxx.com.br/api/verbas?$filter=ano eq 2026&$first=5000&$skip=5000"
}
```

> **Nota:** O `@odata.nextLink` deve ser **URL absoluta completa**. URLs relativas causam
> falha na paginação (dados incompletos no GA 360).

### 3.4 Variações de Nome de Campo — Compatibilidade Atual

O GA 360 hoje aceita múltiplas variações por campo (heurística de discovery). A lista abaixo
mostra o nome **preferido** (em negrito) e as variações atualmente suportadas:

| Campo preferido | Variações aceitas atualmente |
|-----------------|------------------------------|
| **`cpf`** | `cpf_funcionario`, `cpf_colaborador`, `documento`, `nr_cpf`, `cpfcnpj` |
| **`nome_funcionario`** | `funcionario`, `nome`, `nome_colaborador`, `colaborador`, `nome_colab` |
| **`cnpj_empresa`** | `company_external_id`, `cnpj` |
| **`razao_social`** | `empresa`, `nome_empresa`, `razao`, `empresa_nome` |
| **`cod_evento`** | `codigo_evento`, `evento`, `codevento`, `rubrica`, `cod_rubrica`, `id_evento` |
| **`valor`** | `valor_evento`, `vl_evento`, `vl_verba`, `amount` |
| **`competencia`** | `periodo`, `ano_mes`, `mes_ano`, `referencia` |
| **`tipo_verba`** | `tipo`, `verba_tipo`, `categoria_verba` |

**Pedido ao DAB:** padronizar nos nomes preferidos eliminaria a necessidade de heurística e
reduziria risco de campos não mapeados.

### 3.5 Mapeamento `cod_evento → tipo_verba`

Quando o campo `tipo_verba` não está presente no response, o GA 360 infere pelo `cod_evento`.
Tabela atual de mapeamento:

| `cod_evento` | `tipo_verba` inferido | Observação |
|-------------|----------------------|------------|
| 1, 7, 23, 51, 61, 87, 91 | `SALDO_SALARIO` | Salário base e variações |
| 540, 541, 10001, 10027, 10035 | `SALDO_SALARIO` | |
| 10063, 10088, 10095, 10102 | `SALDO_SALARIO` | |
| 30, 10044 | `COMISSAO_DSR` | Comissão + DSR |
| 31 | `BONUS` | Bônus |
| 10087, 10114 | `PREMIO` | Prêmio |
| **10000** | `VERBA_INDENIZATORIA` | **Verba indenizatória** |
| 10054 | `ADIANTAMENTO_VERBA_IDENIZATORIA` | Adiantamento de verba ind. |
| 10008, 10009 | `DESC_PLANO_SAUDE` | Desconto plano de saúde |
| 10098 | `PLANO_SAUDE_EMPRESA` | Plano de saúde empresa |
| 995, 996 | `FGTS` | FGTS |
| _(outros)_ | `OUTROS` | Não mapeados → agrupados em OUTROS |

**Pedido ao DAB:** retornar `tipo_verba` diretamente no response eliminaria esse mapeamento
frágil. Quando um novo evento é criado no sistema de folha, o GA 360 precisa atualizar
manualmente essa tabela para que o dado apareça corretamente.

---

## 4. Problemas Atuais e Ações Solicitadas ao DAB

### 4.1 Tabela de Fricções

| # | Problema | Impacto no GA 360 | Ação solicitada ao DAB |
|---|----------|-------------------|------------------------|
| **P1** | **Full scan sem índice em `ano`**: sem `$filter`, o SQL Server faz scan de toda a tabela | Timeout da Edge Function (>150s) → sync falha → dados não aparecem no portal | Criar índice em `ano` (e de preferência composto `ano, mes`) na tabela de origem da view OData |
| **P2** | **`$filter=ano eq N` lento mesmo com filtro**: índice ausente ou query plan ineficiente | Sync demora >30s mesmo com filtro → timeout parcial → dados incompletos | Garantir que o plano de execução usa o índice ao filtrar por `ano`; verificar com `EXPLAIN` ou SQL Server Execution Plan |
| **P3** | **`@odata.nextLink` retorna URL relativa** (ex: `?$skip=5000` sem domínio) | GA 360 falha ao construir URL da próxima página → paginação incompleta → dados faltando (funcionários não aparecem) | Retornar `@odata.nextLink` sempre como URL absoluta completa: `https://dab.grupoxxx.com.br/api/verbas?$skip=5000&...` |
| **P4** | **Tamanho de página limitado a 500 registros**: retorna apenas 500 por request | Para 50.000 registros/ano: 100 requisições HTTP → sync leva >60s → risco de timeout | Suportar `$first=5000` (ou maior). O GA 360 sempre envia `$first=5000` |
| **P5** | **Campo `cnpj_empresa` ausente no response**: GA 360 usa `razao_social` para match com empresa | Match frágil — variações de grafia, sufixo "LTDA", abreviações → funcionários não associados à empresa correta | Incluir `cnpj_empresa` (CNPJ da empresa do funcionário, 14 dígitos, apenas números) no response |
| **P6** | **Campo `tipo_verba` ausente**: GA 360 infere pelo `cod_evento` via tabela manual | Novos eventos criados no sistema de folha não aparecem no GA 360 até atualização manual do mapeamento | Incluir `tipo_verba` diretamente no response (ex: `"SALDO_SALARIO"`, `"BONUS"`) |
| **P7** | **Nomes de campo inconsistentes** entre versões ou ambientes do DAB | GA 360 precisa de heurística (busca por 5+ variações de nome) — risco de campo não reconhecido | Padronizar nos nomes preferidos da seção 3.4 e manter estáveis entre versões |

### 4.2 Prioridade das Ações

```
🔴 P1 + P2  (índice em `ano`)     — Sem isso, sync de ano completo sempre falha
🔴 P3       (nextLink absoluto)   — Sem isso, apenas a 1ª página é sincronizada
🟡 P4       ($first=5000)         — Reduz tempo de sync de 60s+ para <15s
🟡 P5       (cnpj_empresa)        — Sem isso, match de empresa depende de razão social
🟡 P6       (tipo_verba)          — Sem isso, novos eventos não aparecem sem update manual
🟢 P7       (padronização campos) — Melhoria de manutenibilidade a longo prazo
```

---

## 5. Campos Necessários — Contrato Formal

Lista definitiva de campos que o GA 360 precisa no response, com tipo e obrigatoriedade:

| Campo | Obrigatório | Tipo esperado | Exemplo | Descrição |
|-------|:-----------:|---------------|---------|-----------|
| `cpf` | ✅ | string, 11 dígitos, sem formatação | `"12345678901"` | CPF do funcionário. GA 360 remove não-dígitos automaticamente, mas prefer receber apenas dígitos |
| `nome_funcionario` | ✅ | string | `"JOAO DA SILVA"` | Nome completo |
| `ano` | ✅ | integer | `2026` | Ano de referência do evento de folha |
| `mes` | ✅ | integer (1–12) | `3` | Mês de referência |
| `cod_evento` | ✅ | integer | `1` | Código da rubrica/evento salarial no sistema de folha |
| `valor` | ✅ | decimal (ponto como separador) | `4500.00` | Valor monetário do evento. GA 360 aceita também string numérica |
| `cnpj_empresa` | ✅ * | string, 14 dígitos, sem formatação | `"53113791000122"` | CNPJ da empresa do funcionário. *Critério de match principal — sem isso, usa `razao_social` com risco de erro |
| `razao_social` | 🟡 | string | `"CHOK DISTRIBUIDORA LTDA"` | Razão social da empresa. Usado como fallback quando `cnpj_empresa` não está disponível |
| `tipo_verba` | 🟡 | string uppercase com underscore | `"SALDO_SALARIO"` | Categoria da verba. Quando ausente, GA 360 infere pelo `cod_evento` (ver seção 3.5) |
| `competencia` | 🟢 | string YYYY-MM | `"2026-03"` | Período de competência. Pode ser derivado de `ano` + `mes` se ausente |

> **Legenda:** ✅ Obrigatório · 🟡 Fortemente recomendado · 🟢 Opcional

---

## 6. Como o GA 360 Resolve Empresa (match CPF → company_id)

Este é o ponto de maior fricção atual. O processo é:

```
Registro do DAB (cpf, razao_social, cnpj_empresa)
                  │
                  ▼
  1. Normaliza CPF (remove não-dígitos)
  2. Busca em external_employees por cpf normalizado
     external_employees: cadastro interno dos colaboradores do Grupo Arantes
  3. Se encontrado:
       - Usa accounting_company_id (empresa contábil, prioridade)
       - Fallback: company_id (empresa de registro)
  4. Se NÃO encontrado:
       → Registro vai para payroll_verba_staging (sem company_id)
       → NÃO aparece no portal até o colaborador ser cadastrado em external_employees
       → Administrador vê "X CPFs sem empresa" no painel de sync
```

**Por que `cnpj_empresa` no response resolveria isso:**

Com o CNPJ vindo direto do DAB, o GA 360 poderia fazer o match diretamente com a tabela
`companies` (por `external_id = cnpj`), sem depender do cadastro de `external_employees`.
Isso eliminaria o problema de funcionários que existem no DAB mas ainda não foram
cadastrados no portal.

---

## 7. Métricas de Performance Esperadas

| Cenário | Volume estimado | Meta GA 360 | Situação atual (sem otimizações) |
|---------|-----------------|-------------|----------------------------------|
| Sync ano completo, sem `$filter` | ~50.000 registros | — | >150s (timeout — sync falha) |
| Sync ano completo, com `$filter=ano eq N` + índice | ~50.000 registros | **< 30s** | ~120s (índice ausente) |
| Sync ano completo, otimizado (índice + `$first=5000`) | ~50.000 registros | **< 15s** | — |
| Sync 1 mês, com `$filter=ano eq N and mes eq M` | ~4.000 registros | **< 5s** | ~20s |
| Consulta frontend (pivot já populado, sem chamar DAB) | 0 chamadas DAB | **< 500ms** | < 500ms ✅ |

**Frequência de sync esperada:** sob demanda (usuário clica "Sincronizar") ou agendado
1x/dia no período de fechamento de folha. Não é tempo real.

---

## 8. Configuração da Conexão no GA 360

A conexão com o DAB é configurada pelo administrador do GA 360 em
**Admin > Datalake** (`/admin/datalake`), onde são definidos:

**`dl_connections` (Conexão):**
- `base_url`: URL base da API DAB (ex: `https://dab.grupoxxx.com.br`)
- `auth_config_json.bearerToken`: Bearer token de autenticação
- `headers_json`: headers HTTP customizados

**`dl_queries` (Endpoint de verbas):**
- `endpoint_path`: caminho do endpoint (ex: `/api/verbas`, `/folha/verbas`, `/v1/eventos`)
- `method`: `GET`

O GA 360 monta a URL final como:
```
{base_url}/{endpoint_path}?$filter=ano eq {ANO}&$first=5000
```

---

## 9. Próximos Passos

| Responsável | Ação | Prazo |
|-------------|------|-------|
| **DAB** | Criar índice em `ano` (e `mes`) na tabela de verbas da view OData | Prioritário |
| **DAB** | Alterar `@odata.nextLink` para retornar URL absoluta | Prioritário |
| **DAB** | Incluir campo `cnpj_empresa` no response | Alta prioridade |
| **DAB** | Suportar `$first=5000` (ou definir o máximo suportado) | Alta prioridade |
| **DAB** | Incluir campo `tipo_verba` no response (opcional mas recomendado) | Média prioridade |
| **GA 360** | Adaptar sync-verbas para usar `cnpj_empresa` como critério primário de match | Após DAB implementar P5 |
| **GA 360** | Simplificar heurística de campo após padronização | Após DAB implementar P7 |
| **Ambos** | Validar sync completo de 1 ano em ambiente de homologação | Após P1+P2+P3 implementados |

---

## 10. Apêndice — Exemplo de Requisição e Response Completo

### Requisição típica do GA 360 ao DAB (sync de março/2026):

```http
GET /api/verbas?$filter=ano eq 2026 and mes eq 3&$first=5000
Host: dab.grupoxxx.com.br
Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...
Accept: application/json
```

### Response esperado (primeira página):

```json
{
  "@odata.context": "https://dab.grupoxxx.com.br/api/$metadata#verbas",
  "@odata.count": 4312,
  "value": [
    {
      "cpf": "12345678901",
      "nome_funcionario": "JOAO CARLOS DA SILVA",
      "cnpj_empresa": "53113791000122",
      "razao_social": "CHOK DISTRIBUIDORA LTDA",
      "ano": 2026,
      "mes": 3,
      "cod_evento": 1,
      "tipo_verba": "SALDO_SALARIO",
      "valor": 4500.00,
      "competencia": "2026-03"
    },
    {
      "cpf": "12345678901",
      "nome_funcionario": "JOAO CARLOS DA SILVA",
      "cnpj_empresa": "53113791000122",
      "razao_social": "CHOK DISTRIBUIDORA LTDA",
      "ano": 2026,
      "mes": 3,
      "cod_evento": 10000,
      "tipo_verba": "VERBA_INDENIZATORIA",
      "valor": 1200.00,
      "competencia": "2026-03"
    }
  ],
  "@odata.nextLink": "https://dab.grupoxxx.com.br/api/verbas?$filter=ano eq 2026 and mes eq 3&$first=5000&$skip=5000"
}
```

### Resultado após sync no GA 360 (`payroll_verba_pivot`):

```
company_id    | cpf          | nome_funcionario      | tipo_verba          | ano  | jan   | fev   | mar     | ...
--------------+--------------+-----------------------+---------------------+------+-------+-------+---------+---
<uuid empresa>| 12345678901  | JOAO CARLOS DA SILVA  | SALDO_SALARIO       | 2026 | 4500  | 4500  | 4500    | ...
<uuid empresa>| 12345678901  | JOAO CARLOS DA SILVA  | VERBA_INDENIZATORIA | 2026 | null  | null  | 1200    | ...
```

---

*Dúvidas ou ajustes neste documento: contato via canal GA 360 / Grupo Arantes.*
