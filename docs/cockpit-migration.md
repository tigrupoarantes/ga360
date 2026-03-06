# Migração: Cockpit GA → GA360

> **Status:** Fases 1–5 concluídas ✅ | Fase 6 (validação pós-deploy) pendente
> **Iniciado:** 2026-03-06
> **Objetivo:** Absorver o app standalone `cockpit-ga` dentro do GA360, eliminando o repositório e deploy separados.

---

## Visão Geral

O **Cockpit GA** (`ga-cockpit.vercel.app`) é um painel comercial com KPIs de vendas, heatmap
geográfico, rankings, logística (ABC/FEFO/Estoque) e lista de ataque. Como o GA360 é o portal
corporativo do Grupo Arantes, faz sentido o Cockpit estar incorporado nele como um módulo
`/cockpit` — e não como app solto.

Ambos compartilham o **mesmo stack**: React 18 + TypeScript + Vite + shadcn/ui + Tailwind +
TanStack Query v5 + Supabase + react-router-dom v6. O transplante foi direto, sem reescrita de stack.

---

## Repositórios

| App | Repo local | Deploy |
|---|---|---|
| GA360 (destino) | `c:\GIT GA\GA360` | Vercel — `ga360.grupoarantes.emp.br` |
| Cockpit GA (origem) | `c:\GIT GA\cockpit-ga\ga-cockpit` | Vercel — `ga-cockpit.vercel.app` |

---

## Supabase

| Projeto | ID | Uso |
|---|---|---|
| GA360 (destino) | `zveqhxaiwghexfobjaek` | Todas as tabelas, Edge Functions e auth do módulo cockpit |
| Cockpit standalone (origem) | `vhfrtoorxxcsxjsvfbrb` | A ser descomissionado após validação em produção |

---

## Arquitetura final (pós-migração)

```
GA360 (ga360.grupoarantes.emp.br)
├── /dashboard          → Dashboard executivo (existente)
├── /reunioes           → Reuniões (existente)
├── /processos          → Processos (existente)
├── /okrs               → OKRs (existente)
├── /metas              → Metas com IA (existente)
├── /cockpit            → [NOVO] Home KPIs comerciais
├── /cockpit/mapa       → [NOVO] Heatmap geográfico
├── /cockpit/comercial  → [NOVO] Rankings e tendências
├── /cockpit/logistica  → [NOVO] ABC / Mix / FEFO / Estoque
├── /cockpit/config     → [NOVO] Configuração de conexões (restrito: super_admin/ceo/diretor)
└── /admin              → Admin GA360 (existente)

Supabase GA360 (zveqhxaiwghexfobjaek)
├── Edge Functions (existentes + 6 novas do cockpit)
└── Banco (tabelas existentes + 6 novas do cockpit)
```

---

## Fases

### ✅ Fase 1 — Schema do banco

**Arquivo:** `docs/migration/cockpit-schema.sql`
**Executado em:** Supabase GA360 (`zveqhxaiwghexfobjaek`)

O script criou:

| Tabela / Objeto | Descrição |
|---|---|
| `cockpit_business_units` | Unidades de negócio do datalake (evita colisão com `areas`) |
| `city_dim` | Dimensão geográfica de cidades |
| `client_dim` | Dimensão de clientes |
| `sales_fact_daily` | Fatos de vendas diários (modelo analítico cockpit) |
| `customer_base_snapshot` | Snapshot de base de clientes ativos |
| `dl_connections` | Conexões com APIs externas (substitui `api_connections` do cockpit standalone) |
| `ALTER TYPE system_module` | Adicionados: `cockpit_comercial`, `cockpit_mapa`, `cockpit_logistica`, `cockpit_admin` |
| RLS policies | Policies de isolamento por `company_id` em todas as tabelas acima |

> **Importante:** `dl_connections` armazena credenciais em colunas JSON (`auth_config_json`,
> `headers_json`), não em colunas planas como `api_key`. Ver estrutura abaixo.

---

### ✅ Fase 2 — Edge Functions

Deployadas no Supabase GA360. Todas requerem JWT válido do GA360 no header `Authorization`.

| Function | Rota | Descrição |
|---|---|---|
| `dab-proxy` | POST `/functions/v1/dab-proxy` | Proxy OData para o DAB (`https://api.grupoarantes.emp.br/v1`) com paginação automática |
| `get-companies` | POST `/functions/v1/get-companies` | Lista empresas do datalake |
| `get-kpi-summary` | GET `/functions/v1/get-kpi-summary` | KPIs de vendas agregados por empresa/período |
| `get-geo-heatmap` | GET `/functions/v1/get-geo-heatmap` | Dados de heatmap geográfico |
| `get-city-detail` | GET `/functions/v1/get-city-detail` | Detalhes de vendas por cidade |
| `get-attack-list` | GET `/functions/v1/get-attack-list` | Lista de ataque (ranking de cidades) |

**Deploy das edge functions** (se precisar re-deployar):
```bash
cd "c:/GIT GA/GA360"
npx supabase functions deploy dab-proxy --project-ref zveqhxaiwghexfobjaek
npx supabase functions deploy get-companies --project-ref zveqhxaiwghexfobjaek
npx supabase functions deploy get-kpi-summary --project-ref zveqhxaiwghexfobjaek
npx supabase functions deploy get-geo-heatmap --project-ref zveqhxaiwghexfobjaek
npx supabase functions deploy get-city-detail --project-ref zveqhxaiwghexfobjaek
npx supabase functions deploy get-attack-list --project-ref zveqhxaiwghexfobjaek
```

---

### ✅ Fase 3 — Frontend

Todos os arquivos abaixo foram criados do zero em `src/`.

#### Libraries (`src/lib/`)

| Arquivo | O que faz |
|---|---|
| `cockpit-types.ts` | Todos os tipos do domínio cockpit: `DatalakeCompany`, `CockpitFilters`, `KPISummary`, `CityHeatmapPoint`, `CityDetail`, `ClientAttack`, `ABCItem`, `MixItem`, `DabVendaProd`, `DabStockPosition`, `DabStockLot`, `DlConnection` |
| `dab.ts` | `dabFetch<T>()` — faz chamadas OData ao DAB via Edge Function `dab-proxy` usando o JWT da sessão Supabase GA360 |
| `cockpit-api.ts` | Helpers para chamar as Edge Functions GET: `fetchKPISummaryEdge`, `fetchGeoHeatmapEdge`, `fetchCityDetail`, `fetchAttackList` |

#### Contexts (`src/contexts/`)

| Arquivo | O que mudou |
|---|---|
| `CompanyContext.tsx` | **Atualizado** — adicionado campo `external_id?: string` à interface `Company`. Este campo contém o código numérico DAB da empresa (ex: `'2'`, `'3'`) usado nos filtros OData |
| `CockpitFiltersContext.tsx` | **Novo** — `CockpitFiltersProvider` + hook `useCockpitFilters()`. Controla filtros locais do cockpit: `period`, `channelCode`, `segmentType` |

#### Hooks (`src/hooks/cockpit/`)

| Hook | Descrição |
|---|---|
| `useKPISummary.ts` | Query em `sales_fact_daily` + `customer_base_snapshot` via supabase client |
| `useGeoHeatmap.ts` | Query em `sales_fact_daily` + `city_dim` via supabase client |
| `useAttackList.ts` | Chama `get-attack-list` Edge Function |
| `useCityDetail.ts` | Chama `get-city-detail` Edge Function |
| `useCommercialData.ts` | Queries em `sales_fact_daily`, `city_dim`, `client_dim`, `cockpit_business_units` |
| `useLogisticsData.ts` | Múltiplos exports: `useVendaProd`, `useABCData`, `useMixCampeao`, `useLogisticsOverview`, `useStockPosition`, `useStockLots` — todos via DAB usando `selectedCompany.external_id` em filtros OData |
| `useDatalakeCompanies.ts` | Chama `get-companies` Edge Function |
| `useApiConnection.ts` | CRUD em `dl_connections` — lê credenciais de `auth_config_json` / `headers_json` |
| `useConnectionMonitor.ts` | Testa conectividade da API via `test-api-connection` Edge Function |

#### Components (`src/components/cockpit/`)

| Componente | Descrição |
|---|---|
| `KPICard.tsx` | Card de KPI com valor, variação e ícone |
| `AlertCard.tsx` | Card de alertas/notificações do cockpit |
| `ConnectionStatusBadge.tsx` | Badge de status da conexão DAB; navega para `/cockpit/config` |
| `CockpitFilters.tsx` | Filtros de período/canal/segmento; vive dentro do `<main>` de cada página (não no AppleNav) |
| `ApiConnectionCard.tsx` | Card de configuração de uma `DlConnection` com formulário de edição inline |

#### Pages (`src/pages/cockpit/`)

| Página | Rota | Descrição |
|---|---|---|
| `CockpitHome.tsx` | `/cockpit` | KPIs principais, AlertCard, atalhos para mapa e comercial; wraps em `CockpitFiltersProvider` |
| `CockpitMap.tsx` | `/cockpit/mapa` | Heatmap geográfico por cidade + Sheet drawer com detalhes + aba Mix Ideal |
| `CockpitCommercial.tsx` | `/cockpit/comercial` | Rankings, tendências com AreaChart (recharts), top clientes |
| `CockpitLogistics.tsx` | `/cockpit/logistica` | 5 abas: Visão Geral, ABC, Mix Campeão, Estoque, FEFO |
| `CockpitSettings.tsx` | `/cockpit/config` | Lista e edição de `dl_connections`; restrito por role |

---

### ✅ Fase 4 — Rotas (`src/App.tsx`)

```tsx
// Imports adicionados:
import CockpitHome       from "@/pages/cockpit/CockpitHome";
import CockpitMap        from "@/pages/cockpit/CockpitMap";
import CockpitCommercial from "@/pages/cockpit/CockpitCommercial";
import CockpitLogistics  from "@/pages/cockpit/CockpitLogistics";
import CockpitSettings   from "@/pages/cockpit/CockpitSettings";

// Rotas adicionadas (dentro de <Routes>, antes de <Route path="*">):
<Route path="/cockpit"           element={<ProtectedRoute><CockpitHome /></ProtectedRoute>} />
<Route path="/cockpit/mapa"      element={<ProtectedRoute><CockpitMap /></ProtectedRoute>} />
<Route path="/cockpit/comercial" element={<ProtectedRoute><CockpitCommercial /></ProtectedRoute>} />
<Route path="/cockpit/logistica" element={<ProtectedRoute><CockpitLogistics /></ProtectedRoute>} />
<Route path="/cockpit/config"    element={<ProtectedRoute allowedRoles={["super_admin","ceo","diretor"]}><CockpitSettings /></ProtectedRoute>} />
```

---

### ✅ Fase 5 — Navegação (`src/components/layout/AppleNav.tsx`)

```tsx
// Ícones adicionados ao import lucide-react:
MapPin, Package, Monitor

// Item adicionado ao array navigation (após Relatórios):
{
  name: 'Cockpit',
  icon: Monitor,
  children: [
    { name: 'KPIs Comerciais', href: '/cockpit',            icon: LayoutDashboard },
    { name: 'Mapa / Heatmap',  href: '/cockpit/mapa',       icon: MapPin },
    { name: 'Comercial',       href: '/cockpit/comercial',  icon: TrendingUp },
    { name: 'Logística',       href: '/cockpit/logistica',  icon: Package },
  ]
}
```

> O link `/cockpit/config` não está no nav — é acessado a partir da própria página `/cockpit`
> via `ConnectionStatusBadge` (visível apenas quando a conexão está com problema) ou via URL direta.

---

## Decisões técnicas importantes

| Decisão | Motivo |
|---|---|
| `selectedCompany.id` (UUID) para Supabase | É a chave FK em todas as tabelas (`company_id`) |
| `selectedCompany.external_id` para DAB | Código numérico do DAB (ex: `'2'`); usado em filtros OData `COD_EMPRESA eq 2` |
| `cockpit_business_units` | Evita colisão com `areas` (estrutura org interna do GA360) |
| `sales_fact_daily` | Modelo analítico diferente de `sales_daily` do GA360 (agrega por cliente/canal/geo) |
| `dl_connections` com JSON de credenciais | GA360 já tinha essa tabela; evita criar `api_connections` duplicada; credenciais em `auth_config_json.apiKey` e `auth_config_json.authHeaderName` |
| `useCockpitFilters()` | Substitui `useFilters()` do cockpit standalone; filtros são locais ao módulo |
| `useCompany()` | Substitui `useAuth()` do cockpit para seleção de empresa; usuário já está autenticado no GA360 |
| `CockpitFilters` dentro do `<main>` | Não polui o `AppleNav`; cada página cockpit wraps com `<CockpitFiltersProvider>` |
| Dois Supabase clients no GA360 | `external-client.ts` = auth; `client.ts` = dados. Todos os hooks cockpit usam `@/integrations/supabase/client` |
| Removido `resolveCompanyUuid()` | O cockpit standalone precisava resolver código → UUID. No GA360, `selectedCompany.id` já é o UUID |
| Sem `useAppSettings` / `useIngestRuns` | Eram específicos do cockpit standalone; não foram migrados |

---

## Validações necessárias antes de ir para produção

### 1. Coluna `external_id` na tabela `companies`

Verificar se a coluna existe no Supabase GA360:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'companies' AND column_name = 'external_id';
```

Se não existir, criar e preencher:

```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS external_id text;

-- Preencher com o código DAB de cada empresa
-- (consultar no Supabase do cockpit standalone: SELECT * FROM companies)
UPDATE companies SET external_id = '2' WHERE name ILIKE '%arantes%';
-- Repetir para outras empresas cadastradas no datalake
```

> Sem `external_id` preenchido, todos os hooks de logística (`useLogisticsData`) e os filtros
> de segmento do `CockpitFilters` retornarão dados vazios ou incorretos.

---

### 2. Registro em `dl_connections`

Verificar se existe ao menos um registro ativo:

```sql
SELECT id, name, base_url, is_enabled FROM dl_connections LIMIT 10;
```

Se não existir, inserir:

```sql
INSERT INTO dl_connections (
  company_id,
  name,
  base_url,
  is_enabled,
  auth_config_json,
  headers_json
)
VALUES (
  '<uuid-da-empresa-no-GA360>',    -- copiar de: SELECT id, name FROM companies
  'DAB Grupoarantes',
  'https://api.grupoarantes.emp.br/v1',
  true,
  '{"apiKey": "<API_KEY_DO_DAB>", "authHeaderName": "X-API-Key"}',
  '{}'
);
```

> Alternativamente, após o deploy do GA360, acessar `/cockpit/config` com um usuário
> `super_admin/ceo/diretor` e cadastrar via UI.

---

### 3. Edge Functions acessíveis

Testar diretamente via curl ou Postman que as Edge Functions respondem com o JWT de um usuário GA360:

```bash
# Substituir <JWT> pelo token obtido no localStorage do GA360 (supabase.auth.getSession())
curl -X POST \
  https://zveqhxaiwghexfobjaek.supabase.co/functions/v1/get-companies \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json"
```

Resposta esperada: array de empresas do datalake.

---

### 4. Teste de navegação no GA360 (pós-deploy)

| URL | Esperado |
|---|---|
| `/cockpit` | Página carrega, KPIs aparecem (podem ser zeros se tabelas vazias) |
| `/cockpit/mapa` | Mapa renderiza, sem erros de console |
| `/cockpit/comercial` | Gráficos renderizam |
| `/cockpit/logistica` | Abas funcionam; dados do DAB carregam se `dl_connections` configurado |
| `/cockpit/config` | Acessível para `super_admin/ceo/diretor`; redireciona (403 ou dashboard) para outros roles |

---

### 5. TypeScript build local

```bash
cd "c:/GIT GA/GA360"
npx tsc --noEmit
```

> Já foi validado durante o desenvolvimento — retornou zero erros. Repetir antes do push.

---

## Deploy

```bash
cd "c:/GIT GA/GA360"

# Verificar o que será commitado
git status
git diff --stat

# Stagear apenas os arquivos do cockpit + App.tsx + AppleNav.tsx
git add src/lib/cockpit-types.ts
git add src/lib/dab.ts
git add src/lib/cockpit-api.ts
git add src/contexts/CompanyContext.tsx
git add src/contexts/CockpitFiltersContext.tsx
git add src/hooks/cockpit/
git add src/components/cockpit/
git add src/pages/cockpit/
git add src/App.tsx
git add src/components/layout/AppleNav.tsx
git add docs/cockpit-migration.md

git commit -m "feat(cockpit): migra módulo Cockpit GA para GA360

- Adiciona rotas /cockpit, /cockpit/mapa, /cockpit/comercial, /cockpit/logistica, /cockpit/config
- Transplanta hooks, componentes e páginas do cockpit standalone
- Atualiza CompanyContext com external_id para integração DAB
- Adiciona item Cockpit ao AppleNav
- Novo contexto CockpitFiltersContext para filtros locais do módulo"

git push origin master
```

O Vercel deploy será disparado automaticamente.

---

## Fase 7 — Descomissionamento (executar APÓS validação em produção)

Só executar após confirmar que o módulo `/cockpit` no GA360 está estável em produção
e os usuários migraram.

**1. Redirect no cockpit standalone**

Editar `c:\GIT GA\cockpit-ga\ga-cockpit\vercel.json`:

```json
{
  "redirects": [
    {
      "source": "/(.*)",
      "destination": "https://ga360.grupoarantes.emp.br/cockpit/$1",
      "permanent": true
    }
  ]
}
```

**2. Arquivar repositório**

No GitHub: Settings → Danger Zone → Archive this repository (torna read-only).

**3. Remover projeto Supabase standalone**

No dashboard Supabase: projeto `vhfrtoorxxcsxjsvfbrb` → Settings → Delete project.

> Antes de deletar: fazer dump dos dados se houver histórico relevante em `sales_daily` ou outras tabelas.

**4. Remover deployment Vercel**

No Vercel: projeto `ga-cockpit` → Settings → Delete project.

---

## Referências rápidas

```
Supabase GA360:     https://supabase.com/dashboard/project/zveqhxaiwghexfobjaek
DAB endpoint:       https://api.grupoarantes.emp.br/v1
GA360 prod:         https://ga360.grupoarantes.emp.br
Cockpit standalone: https://ga-cockpit.vercel.app (a ser descomissionado)
```
