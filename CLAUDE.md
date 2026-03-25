# GA 360 — Guia para Claude Code

## Sobre o Projeto

Portal corporativo de gestao estrategica do **Grupo Arantes** (produto: GA 360 / CRESCER+).
Unifica reunioes, tarefas, OKRs, metas, governanca EC, trade marketing, cockpit comercial/logistica e analytics em um unico app multi-empresa com RBAC.

**Deploy:** sempre validar localmente antes de subir para producao (ver secao Fluxo de Deploy).

---

## Stack

| Camada | Tech |
|--------|------|
| Frontend | React 18.3 + TypeScript 5.8 |
| Build | Vite 7.3 + SWC (`@vitejs/plugin-react-swc`) |
| UI | shadcn/ui (Radix UI) + Tailwind CSS 3.4 |
| Routing | React Router v6.30 |
| Server State | TanStack React Query v5.83 |
| Client State | React Context (AuthContext, CompanyContext, CockpitFiltersContext) |
| Forms | React Hook Form 7.61 + Zod 3.25 |
| Charts | Recharts 2.15 |
| Tema | next-themes (dark/light/system) |
| Toasts | Sonner |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions + Storage + RLS) |
| External Data | DAB (Data Access Bridge) — SQL Server datalake via `dab-proxy` Edge Function |
| IA | ElevenLabs Scribe (transcricao) + OpenAI (ATA/relatorios/goal-assistant) |
| PDF | jsPDF |
| Deploy | Vercel (SPA rewrite em vercel.json) |
| Analytics | @vercel/analytics + @vercel/speed-insights |

---

## Arquitetura de Diretórios

```
src/
├── assets/              # Imagens e SVGs estáticos (3 arquivos)
├── components/          # Componentes organizados por módulo (~108 arquivos)
│   ├── admin/           # Formulários e gestão de admin (11)
│   ├── analytics/       # Gráficos e KPIs (5)
│   ├── auth/            # ProtectedRoute, RoleGuard, TwoFactorAuth (3)
│   ├── cockpit/         # KPIs, filtros, ranking (9)
│   ├── controle-pj/     # Contratos PJ (5)
│   ├── dashboard/       # Stats e atividades recentes (2)
│   ├── employees/       # Importação e conversão de funcionários (4)
│   ├── feedback/        # BugReportDialog (1)
│   ├── gamification/    # Badges, leaderboard, perfil (4)
│   ├── governanca-ec/   # Cards EC, evidências, datalake viewer (22)
│   ├── layout/          # MainLayout, AdminLayout, AppleNav, Sidebar (6)
│   ├── meetings/        # Cards, formulários, transcrição, ATA (14)
│   ├── metas/           # GoalAgentPanel (1)
│   ├── okrs/            # Objectives, Key Results (6)
│   ├── processes/       # Checklists, execução (7)
│   ├── reports/         # Assistente IA de relatórios (3)
│   ├── settings/        # Config email, OpenAI, WhatsApp, invite (6)
│   ├── stock-audit/     # Wizard e relatórios de auditoria (3+)
│   ├── tasks/           # TaskFormDialog (1)
│   ├── trade/           # Indústrias, materiais, movimentações (7)
│   ├── ui/              # shadcn/ui primitivos (53)
│   └── verbas-indenizatorias/  # Dashboard, tabela, filtros, D4Sign (9)
├── config/              # supabase.config.ts
├── contexts/            # AuthContext, CompanyContext, CockpitFiltersContext
├── hooks/               # Custom hooks (11 + cockpit subdir com 8)
│   └── cockpit/         # useApiConnection, useCommercialData, useLogisticsData, etc.
├── integrations/        # Supabase client, external-client, types
│   └── supabase/
├── lib/                 # Utilitários, tipos, PDF generators, DAB client (11)
├── pages/               # 1 arquivo por rota (43 páginas)
│   └── cockpit/         # CockpitHome, Commercial, Logistics, Map, Pedidos, etc. (8)
└── services/            # employeesApiSource.ts
```

---

## Mapa Completo de Rotas

### Públicas
| Rota | Página | Descrição |
|------|--------|-----------|
| `/auth` | Auth | Login/cadastro |
| `/reset-password` | ResetPassword | Recuperação de senha |
| `/confirm-attendance` | ConfirmAttendance | Confirmar presença em reunião |
| `/change-password` | ChangePassword | Trocar senha |

### Protegidas (requer autenticação)
| Rota | Página | Permissão |
|------|--------|-----------|
| `/dashboard` | Dashboard | — |
| `/dashboard/me` | DashboardMe | — |
| `/reunioes` | Meetings | — |
| `/reunioes/:id/executar` | MeetingExecution | — |
| `/processos` | Processes | — |
| `/tarefas` | Tasks | — |
| `/calendario` | Calendar | — |
| `/trade` | Trade | — |
| `/okrs` | OKRs | — |
| `/metas` | Metas | `metas:view` |
| `/analytics` | Analytics | — |
| `/gamificacao` | Gamification | — |
| `/relatorios` | Reports | — |
| `/profile` | Profile | — |

### Governança EC
| Rota | Página |
|------|--------|
| `/governanca-ec` | GovernancaEC |
| `/governanca-ec/:areaSlug` | GovernancaECArea |
| `/governanca-ec/:areaSlug/:cardId` | GovernancaECCardDetail |
| `/governanca-ec/pessoas-cultura/qlp` | QLPPage |
| `/governanca-ec/pessoas-cultura/controle-pj` | ControlePJ |
| `/governanca-ec/pessoas-cultura/controle-pj/:contractId` | ControlePJDetail |
| `/governanca-ec/pessoas-cultura/verbas` | Verbas |
| `/governanca-ec/pessoas-cultura/verbas-indenizatorias` | VerbasIndenizatorias |
| `/governanca-ec/auditoria/estoque` | StockAuditStart |
| `/governanca-ec/auditoria/estoque/:auditId` | StockAuditExecution |

### Cockpit GA
| Rota | Página | Permissão |
|------|--------|-----------|
| `/cockpit` | CockpitHome | — |
| `/cockpit/mapa` | CockpitMap | — |
| `/cockpit/comercial` | CockpitCommercial | — |
| `/cockpit/logistica` | CockpitLogistics | — |
| `/cockpit/pedidos` | CockpitPedidos | — |
| `/cockpit/nao-vendas` | CockpitNaoVendas | — |
| `/cockpit/config` | CockpitSettings | `super_admin, ceo, diretor` |

### Admin (nested em `AdminLayout`, requer `admin:view` + roles `super_admin/ceo/diretor`)
| Rota | Página |
|------|--------|
| `/admin/users` | AdminUsers (index) |
| `/admin/estrutura` | AdminOrganization |
| `/admin/areas` | AdminAreas |
| `/admin/empresas` | AdminCompanies |
| `/admin/permissions` | AdminPermissions |
| `/admin/settings` | AdminSettings |
| `/admin/employees` | AdminEmployees |
| `/admin/governanca-ec` | AdminGovernancaEC |
| `/admin/datalake` | AdminDatalake |
| `/admin/bugs` | AdminBugReports |
| `/admin/api-keys` | AdminApiKeys |
| `/admin/d4sign` | AdminD4Sign |
| `/admin/cockpit-vendas` | AdminCockpitVendas |

---

## Convenções de Código — OBRIGATÓRIAS

### Estrutura de arquivos
- Páginas: `src/pages/NomePagina.tsx` — 1 arquivo por rota
- Componentes: `src/components/<modulo>/NomeComponente.tsx` — PascalCase
- Hooks: `src/hooks/useNomeHook.ts` — prefixo `use`, camelCase
- Hooks de módulo: `src/hooks/<modulo>/useNomeHook.ts` (ex: `src/hooks/cockpit/`)
- Path alias: `@/` -> `src/`

### Padrão de data fetching (React Query + Supabase)
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['entidade', selectedCompany?.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('tabela')
      .select('*')
      .eq('company_id', selectedCompany?.id);
    if (error) throw error;
    return data;
  },
  enabled: !!selectedCompany?.id,
});
```

### Padrão de mutation
```typescript
const mutation = useMutation({
  mutationFn: async (values) => {
    const { data, error } = await supabase.from('tabela').insert(values).select().single();
    if (error) throw error;
    return data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['entidade'] });
    toast.success('Mensagem de sucesso');
  },
  onError: (error) => toast.error('Erro: ' + error.message),
});
```

### Proteção de rotas
```tsx
<ProtectedRoute requiredPermission={{ module: 'modulo', action: 'view' }}>
  <Pagina />
</ProtectedRoute>

<ProtectedRoute allowedRoles={["super_admin", "ceo", "diretor"]}>
  <PaginaAdmin />
</ProtectedRoute>

<RoleGuard roles={['super_admin', 'ceo']}>
  <BotaoAdmin />
</RoleGuard>
```

### Estilos
- Sempre Tailwind classes + `cn()` de `@/lib/utils` para merge condicional
- Nunca CSS inline ou styled-components

### Formulários
- Sempre React Hook Form + Zod schema para validação
- Nunca state local simples para formulários complexos

---

## Multi-empresa e Isolamento

- **SEMPRE** usar `selectedCompany?.id` do `CompanyContext` nas queries
- **SEMPRE** passar `company_id` em inserts
- RLS no Supabase filtra dados automaticamente, mas o frontend deve reforçar
- `enabled: !!selectedCompany?.id` em todo `useQuery` dependente de empresa

---

## Modelo de Permissões

```
Roles: super_admin > ceo > diretor > gerente > colaborador

Permissões por módulo (user_permissions):
  module: system_module enum
  can_create | can_read | can_update | can_delete

Permissões por card EC (ec_card_permissions):
  can_view | can_fill | can_review | can_manage
  Hook: useCardPermissions(cardId)

Funções SQL de verificação:
  has_role(user_id, role)
  has_permission(user_id, module, action)
  has_card_permission(user_id, card_id, permission)
```

---

## Contexts (Estado Global)

| Context | Arquivo | Responsabilidade |
|---------|---------|------------------|
| `AuthContext` | `src/contexts/AuthContext.tsx` | Autenticação, sessão, roles, permissões do usuário |
| `CompanyContext` | `src/contexts/CompanyContext.tsx` | Empresa selecionada (multi-company switching) |
| `CockpitFiltersContext` | `src/contexts/CockpitFiltersContext.tsx` | Filtros compartilhados do módulo Cockpit |

---

## Custom Hooks

### Hooks Gerais
| Hook | Descrição |
|------|-----------|
| `useCardPermissions` | Permissões de cards EC |
| `useControlePJ` | CRUD de contratos PJ |
| `useVerbasIndenizatorias` | Documentos D4Sign de verbas |
| `useStockAudit` | Auditoria de estoque |
| `useCockpitKpis` | KPIs gerais do cockpit |
| `useCockpitPedidos` | Pedidos do cockpit |
| `useCockpitVinculo` | Vínculos cockpit-empresa |
| `useAvatarUpload` | Upload de avatar do usuário |
| `use-mobile` | Detecção de viewport mobile |
| `use-toast` | Toast notifications (shadcn) |

### Hooks do Cockpit (`src/hooks/cockpit/`)
| Hook | Descrição |
|------|-----------|
| `useApiConnection` | Conexão com API DAB |
| `useAttackList` | Lista de ataque comercial |
| `useCommercialData` | Dados comerciais do datalake |
| `useLogisticsData` | Dados logísticos do datalake |
| `useCityDetail` | Detalhamento por cidade |
| `useConnectionMonitor` | Monitor de conexão DAB |
| `useDatalakeCompanies` | Empresas do datalake |
| `useGeoHeatmap` | Dados de heatmap geográfico |
| `useKPISummary` | Resumo de KPIs |

---

## Edge Functions (Supabase/Deno)

Ficam em `supabase/functions/<nome>/index.ts`. Deploy: `supabase functions deploy <nome>`.

### Categorias de Edge Functions

**Autenticação & Segurança:**
- `verify-2fa-code`, `send-2fa-code` — Two-factor auth
- `request-password-reset` — Reset de senha
- `create-user`, `import-users`, `create-users-from-employees` — Gestão de usuários

**Reuniões & Comunicação:**
- `generate-ata` — Geração de ATA com OpenAI
- `transcribe-meeting`, `elevenlabs-scribe-token` — Transcrição ElevenLabs
- `send-meeting-notification`, `send-meeting-reminders` — Notificações
- `send-attendance-confirmation`, `confirm-attendance` — Confirmação de presença
- `send-email-smtp`, `send-invite`, `send-whatsapp-reminder` — Canais de comunicação

**Verbas Indenizatórias (D4Sign):**
- `d4sign-proxy`, `d4sign-webhook` — Proxy e webhook D4Sign
- `save-d4sign-template`, `list-d4sign-templates` — Templates
- `generate-verba-indenizatoria-doc` — Geração de documentos
- `verba-indenizatoria-query`, `verbas-secure-query` — Consultas seguras
- `send-verba-indenizatoria-notification` — Notificações
- `sync-verbas` — Sincronização com DAB

**Cockpit (Dados Comerciais/Logísticos):**
- `cockpit-sales-sync`, `cockpit-vendas-sync`, `cockpit-vendas-query` — Vendas
- `kpi-summary`, `geo-heatmap`, `city-detail`, `attack-list` — Analytics geográfico
- `dab-proxy` — Proxy para Data Access Bridge (SQL Server)

**IA & Relatórios:**
- `ai-gateway` — Gateway para OpenAI
- `goal-assistant` — Assistente IA para metas (com tools, config, access control)
- `generate-report` — Geração de relatórios

**PJ & Folha:**
- `generate-pj-payslip`, `send-pj-payslip-email` — Holerites PJ

**Outros:**
- `sync-employees` — Sincronização de funcionários
- `get-companies` — Listagem de empresas
- `generate-stock-audit-report` — Relatório de auditoria de estoque
- `test-api-connection`, `test-openai-connection`, `test-smtp-connection` — Testes de conexão
- `public-api` — API pública com rotas (kpis, goals, companies, meetings, webhooks)
- `mcp-server` — Integração MCP server

### Regras para Edge Functions
- **Nunca expor credenciais no frontend** — tudo passa por Edge Function
- Usar `service_role` key para operações administrativas
- Dados sensíveis (verbas, salários, CPF) -> apenas via Edge Function

---

## Supabase Migrations

105+ migration files em `supabase/migrations/`. Principais domínios:
- Multi-company RLS policies
- User permissions system
- Governança EC (cards, áreas, permissões por card)
- Verbas indenizatórias + D4Sign (config, templates, documentos, logs)
- Cockpit vendas (foundation, sync, staging/pivot)
- Controle PJ (contratos, férias, encerramentos)
- Public API (keys, webhooks)
- Metas module
- 2FA, stock audit, external employees

---

## Adicionando um Novo Módulo — Checklist

1. `src/pages/NovoModulo.tsx`
2. Rota em `src/App.tsx` com `<ProtectedRoute>`
3. Componentes em `src/components/novo-modulo/`
4. Hook(s) em `src/hooks/useNovoModulo.ts` (ou `src/hooks/novo-modulo/` se complexo)
5. Migration SQL em `supabase/migrations/`
6. Atualizar `src/integrations/supabase/types.ts`
7. Item de navegação em `src/components/layout/AppleNav.tsx` (se módulo principal)
8. Se necessário: Edge Function em `supabase/functions/`
9. Se admin: adicionar rota nested em `/admin` no `App.tsx`

---

## Documentação Disponível

| Documento | Caminho | Descrição |
|-----------|---------|-----------|
| PRD | `docs/PRD.md` | Requisitos completos do produto |
| Technical | `docs/TECHNICAL.md` | Documentação técnica detalhada |
| UX Guidelines | `docs/UX.md` | Diretrizes de UX |
| D4Sign Spec | `docs/verbas-indenizatorias-d4sign.md` | Integração D4Sign |
| Verbas DAB | `docs/GA360_VERBAS_DAB_INTEGRACAO.md` | Integração DAB para verbas |
| Cockpit Migration | `docs/cockpit-migration.md` | Guia de migração cockpit |
| Agent Guides | `docs/agents/*.md` | Guias por especialidade (dev, ux, security, qa, dba, integrations) |
| Migration Resources | `docs/migration/` | Scripts de RLS, schema, seed data |

---

## Arquivos Críticos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/App.tsx` | Todas as rotas da aplicação (43 páginas) |
| `src/contexts/AuthContext.tsx` | Auth, roles, permissões |
| `src/contexts/CompanyContext.tsx` | Empresa selecionada (multi-company) |
| `src/contexts/CockpitFiltersContext.tsx` | Filtros do módulo Cockpit |
| `src/components/layout/AppleNav.tsx` | Navegação principal |
| `src/components/layout/AdminLayout.tsx` | Layout do painel admin com sidebar |
| `src/components/auth/ProtectedRoute.tsx` | Proteção de rotas (auth + roles + permissões) |
| `src/components/auth/RoleGuard.tsx` | Renderização condicional por role |
| `src/integrations/supabase/client.ts` | Cliente Supabase (frontend) |
| `src/integrations/supabase/external-client.ts` | Cliente Supabase alternativo |
| `src/integrations/supabase/types.ts` | Tipos gerados do Supabase |
| `src/lib/types.ts` | Tipos compartilhados do frontend |
| `src/lib/utils.ts` | Utilitários (cn, etc.) |
| `src/lib/cockpit-api.ts` | Cliente API do cockpit (DAB) |
| `src/lib/cockpit-types.ts` | Tipos do módulo cockpit |
| `src/lib/dab.ts` | Cliente DAB (Data Access Bridge) |
| `src/config/supabase.config.ts` | Configuração Supabase |
| `supabase/config.toml` | Config do Supabase local |
| `docs/PRD.md` | Requisitos completos do produto |
| `docs/TECHNICAL.md` | Documentação técnica detalhada |

---

## Módulos em Desenvolvimento Ativo (2026-03)

### Verbas Indenizatórias (D4Sign)
- **Rota**: `/governanca-ec/pessoas-cultura/verbas-indenizatorias`
- **Spec**: `docs/verbas-indenizatorias-d4sign.md`
- **Status atual**:
  - Edge Functions: `d4sign-proxy`, `d4sign-webhook`, `save-d4sign-template`, `list-d4sign-templates`, `generate-verba-indenizatoria-doc`, `verba-indenizatoria-query`, `verbas-secure-query`, `send-verba-indenizatoria-notification`, `sync-verbas`
  - Página: `src/pages/VerbasIndenizatorias.tsx`
  - Admin: `src/pages/AdminD4Sign.tsx` + componentes admin (D4SignConfigForm, D4SignConfigStatus, D4SignTemplateEditor, D4SignTemplateManager)
  - Componentes: VIStatusDashboard, VIDocumentTable, VIDocumentDetail, VIFilters, VIGenerateDialog, VIStatusBadge, VIBatchGenerateDialog, VIDocumentPreview, VITimelineLog
  - Hook: `useVerbasIndenizatorias.ts`

### Cockpit GA
- **Rotas**: `/cockpit/*` (Home, Mapa, Comercial, Logística, Pedidos, Não-Vendas, Config)
- **Dados**: SQL Server datalake via DAB proxy
- **Hooks dedicados**: 8 hooks em `src/hooks/cockpit/`
- **Context**: `CockpitFiltersContext` para filtros compartilhados
- **Admin**: `AdminCockpitVendas` para gestão de vínculos
- **Edge Functions**: `cockpit-sales-sync`, `cockpit-vendas-sync`, `cockpit-vendas-query`, `kpi-summary`, `geo-heatmap`, `city-detail`, `attack-list`, `dab-proxy`

### Metas (Goal Assistant)
- **Rota**: `/metas`
- **Edge Function**: `goal-assistant` (com tools, config, access control, provider)
- **Componente**: `GoalAgentPanel` — painel de IA para metas

### Public API
- **Edge Function**: `public-api` com sub-rotas (kpis, goals, companies, meetings, webhooks)
- **Admin**: `AdminApiKeys` para gestão de chaves de API

---

## Regras de Segurança

- Nunca expor `service_role` key no frontend
- Sempre habilitar RLS em novas tabelas
- Usar parênteses explícitos em políticas RLS com `OR`
- Dados sensíveis (verbas, salários, CPF) -> apenas via Edge Function com `service_role`
- Nunca incluir dados de outras empresas em queries do frontend
- 2FA disponível via Edge Functions `send-2fa-code` e `verify-2fa-code`

---

## Fluxo de Deploy — OBRIGATÓRIO

**Nunca subir direto para produção sem validar localmente.**

### Ordem obrigatória antes de qualquer push para `main`

1. **Deploy local** — rodar o dev server e verificar as alterações na UI
   ```bash
   npm run dev
   ```

2. **Testes** — chamar a skill `ga360-tests` para validar a feature alterada

3. **Build de produção** — garantir que não há erros de compilação
   ```bash
   npm run build
   ```

4. **Lint** — sem warnings/errors
   ```bash
   npm run lint
   ```

5. **Só então** fazer push para `main` -> Vercel faz deploy automático em produção

> **Atenção:** o push para `main` aciona deploy imediato em produção para o Grupo Arantes.
> Sempre confirmar com o usuário antes de fazer `git push`.

---

## Comandos Úteis

```bash
npm run dev          # Dev server (porta 8080, fallback 8081)
npm run build        # Build de produção
npm run build:dev    # Build modo development
npm run preview      # Preview do build local
npm run lint         # Lint (ESLint 9 flat config)

supabase functions deploy <nome>   # Deploy de Edge Function
supabase db push                   # Aplicar migrations
```

---

## Skills Disponíveis (usar SEMPRE que aplicável)

- `ga360-dev` — criar/editar/refatorar qualquer arquivo do GA 360
- `ga360-features` — planejar/especificar nova funcionalidade
- `ga360-domain` — dúvidas de negócio/processo do Grupo Arantes
- `ga360-review` — code review de componentes/hooks/edge functions
- `ga360-ux` — melhorias de interface e usabilidade
- `ga360-tests` — testes unitários/integração
