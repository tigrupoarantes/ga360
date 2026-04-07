# GA 360 — Guia para Claude Code

## Planejamento Estratégico 2026 — Orientador Obrigatório

> **Leia antes de qualquer coisa.** O PE 2026 é o norte estratégico de todo o desenvolvimento do GA360.

**Documentos:**
- Síntese Markdown: `docs/PLANEJAMENTO_ESTRATEGICO_2026.md` ← **ler sempre ao planejar features**
- PDF completo: `docs/mvp - Livro Planejamento Estratégico 2026 - v1.pdf` (129 páginas)
- Autor: Felipe F. Silva — Gerente de Planejamento Estratégico

**Resumo do PE 2026:**
- Tema do ano: **CRESCER+ & MELHOR** | Triênio: **TRANSFORMAÇÃO (2026–2028)**
- Meta: **R$1 bilhão de faturamento**
- 6 Prioridades: Rentabilidade · Excelência/Logística · Crescimento Comercial · Processo/Rotina · Pessoas · Dados/Transformação
- 7 Pilares: Faturamento · Rentabilidade · Clima Organizacional · Market Share · Satisfação do Cliente · Distribuição Numérica · ESG
- Scoring: 1000pts (Performance 60% + Processo 30% + Compliance 10%)
- Empresas: Broker J Arantes · Chok Distribuidora · G4 Distribuidora · Chokdoce · Chok Agro

**Regras obrigatórias:**
1. **Toda nova feature deve ser justificada por ao menos uma das 6 Prioridades do PE.** Se não se encaixa em nenhuma, questionar a prioridade.
2. **Usar a terminologia do PE.** "RPS" não é "daily meeting". "FGE" não é "quarterly review". "Matinal de Vendas" não é "morning standup".
3. **Decisões estratégicas passam pelo Felipe Silva (GPE).** Mudanças que afetem KPIs, scoring, rituais de gestão ou estrutura do PE devem ser validadas com ele antes.
4. **GA360 é o produto do Setor de Transformação.** O Setor de Transformação = Transformação Digital + Marketing + Planejamento Estratégico. O GA360 serve ao Setor de Transformação e ao grupo como um todo.

---

## Sobre o Projeto

Portal corporativo de gestão estratégica do **Grupo Arantes** (produto: GA 360 / CRESCER+).
Unifica reuniões, tarefas, OKRs, metas, governança EC, trade marketing e analytics em um único app multi-empresa com RBAC.

**Deploy:** sempre validar localmente antes de subir para produção (ver seção Fluxo de Deploy).

---

## Stack

| Camada | Tech |
|--------|------|
| Frontend | React 18.3 + TypeScript 5.x |
| Build | Vite 7.3 + SWC |
| UI | shadcn/ui (Radix UI) + Tailwind CSS 3.4 |
| Routing | React Router v6.30 |
| Server State | TanStack React Query v5.83 |
| Client State | React Context (AuthContext, CompanyContext) |
| Forms | React Hook Form + Zod |
| Charts | Recharts 2.15 |
| Tema | next-themes (dark/light) |
| Toasts | Sonner |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions + Storage + RLS) |
| IA | ElevenLabs Scribe (transcrição) + OpenAI (ATA/relatórios) |
| PDF | jsPDF |
| Deploy | Vercel (SPA rewrite em vercel.json) |

---

## Convenções de Código — OBRIGATÓRIAS

### Estrutura de arquivos
- Páginas: `src/pages/NomePagina.tsx` — 1 arquivo por rota
- Componentes: `src/components/<modulo>/NomeComponente.tsx` — PascalCase
- Hooks: `src/hooks/useNomeHook.ts` — prefixo `use`, camelCase
- Path alias: `@/` → `src/`

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

## Adicionando um Novo Módulo — Checklist

1. `src/pages/NovoModulo.tsx`
2. Rota em `src/App.tsx` com `<ProtectedRoute>`
3. Componentes em `src/components/novo-modulo/`
4. Migration SQL em `supabase/migrations/`
5. Atualizar `src/integrations/supabase/types.ts`
6. Item de navegação em `src/components/layout/AppleNav.tsx` (se módulo principal)

---

## Edge Functions (Deno)

- Ficam em `supabase/functions/<nome>/index.ts`
- Deploy: `supabase functions deploy <nome>`
- **Nunca expor credenciais no frontend** — tudo passa por Edge Function
- Usar `service_role` key para operações administrativas

---

## Orquestração de Skills — SEGUIR SEMPRE

### Inventário de Skills

| Skill | Papel | Quando acionar |
|-------|-------|----------------|
| `ga360-features` | Arquiteto | Planejar feature nova (spec, escopo, fases) |
| `ga360-dba` | DBA | Migration, RLS, índice, função SQL, otimização |
| `ga360-dev` | Desenvolvedor | Criar/editar componente, hook, página, Edge Function |
| `ga360-tests` | QA | Escrever/revisar testes, cobertura |
| `ga360-review` | Revisor | Code review, checklist de segurança, qualidade |
| `ga360-ux` | Designer | Melhorar interface, usabilidade, layout |
| `ga360-domain` | Analista de negócio | Regras de negócio, processos, KPIs, fluxos do Grupo Arantes |
| `ga360-bi` | Analista de dados | Insights, dashboards, análises, rankings, tendências |
| `ga360-mcp` | Integrador | Registrar tools MCP, buscar dados reais via servidor MCP |
| `ga360-security` | Auditor CISSP | Pentest, secrets, CORS, RLS, brute force, OWASP Top 10, secure-by-design |
| `ga360-legal` | Advogado/Paralegal | Compliance trabalhista, tributário, LGPD, assinatura eletrônica, empresa de registro |
| `ga360-skill-builder` | Meta-skill | Criar novas skills a partir do código real |

### Fluxos Orquestrados (seguir na ordem)

**FEATURE NOVA** (usuário pede funcionalidade, módulo, tela):
```
1. ga360-features  → spec completa (negócio + técnico + DB + componentes)
2. ga360-dba       → migration SQL + RLS + índices
3. ga360-dev       → implementar páginas, componentes, hooks, Edge Functions
4. ga360-mcp       → registrar tools MCP se a feature expõe dados consultáveis
5. ga360-tests     → testes unitários + integração
6. ga360-review    → checklist de segurança + qualidade antes de entregar
```

**CRIAR COMPONENTE/HOOK/PÁGINA** (implementação direta sem migration):
```
1. ga360-dev       → implementar seguindo padrões
2. ga360-tests     → teste do componente/hook
```

**MIGRATION/SQL** (criar tabela, alterar schema, RLS):
```
1. ga360-dba       → migration + RLS + índices + trigger updated_at
```

**MELHORAR INTERFACE** (UX, layout, usabilidade):
```
1. ga360-ux        → análise e proposta de melhoria
2. ga360-dev       → implementar as mudanças
```

**ANÁLISE DE DADOS** (insights, KPIs, dashboards):
```
1. ga360-mcp       → buscar dados reais via MCP tools
2. ga360-bi        → analisar, correlacionar, recomendar ações
```

**CODE REVIEW** (revisar código existente ou recém-criado):
```
1. ga360-review    → checklist completo (segurança, performance, padrões)
```

**AUDITORIA DE SEGURANÇA** (pentest, vulnerabilidades, hardening):
```
1. ga360-security  → varredura completa (secrets, CORS, auth, RLS, OWASP)
2. ga360-dba       → corrigir RLS, policies, constraints
3. ga360-dev       → corrigir código (CORS, rate limiting, validation)
4. ga360-security  → re-auditar após correções
```

**DÚVIDA DE NEGÓCIO** (como funciona X, qual a regra de Y):
```
1. ga360-domain    → responder com contexto do Grupo Arantes
```

### Regras de Orquestração

1. **Nunca pular etapas** — seguir o fluxo completo na ordem definida
2. **Cada skill lê o código real** — nunca inventar; sempre ler arquivos antes de agir
3. **Handoff explícito** — ao terminar uma etapa, informar o usuário e iniciar a próxima
4. **Parar se bloqueado** — se uma etapa precisa de decisão do usuário, perguntar antes de continuar
5. **Uma skill por vez** — não misturar responsabilidades (DBA não implementa componentes, Dev não cria migrations)
6. **Review obrigatório** — toda feature nova passa por `ga360-review` antes de ser apresentada como pronta
7. **MCP obrigatório em features com dados** — se a feature cria entidades consultáveis, registrar tool no MCP server

---

## Módulos em Desenvolvimento Ativo (2026-03)

### Verbas Indenizatórias (D4Sign)
- **Rota**: `/governanca-ec/pessoas-cultura/verbas-indenizatorias`
- **Spec**: `docs/verbas-indenizatorias-d4sign.md`
- **Status atual**:
  - ✅ Edge Functions: `d4sign-proxy`, `d4sign-webhook`
  - ✅ Página: `src/pages/VerbasIndenizatorias.tsx`
  - ✅ Admin: `src/pages/AdminD4Sign.tsx` + componentes admin
  - ✅ Componentes: VIStatusDashboard, VIDocumentTable, VIDocumentDetail, VIFilters, VIGenerateDialog, VIStatusBadge
  - ✅ Hook: `useVerbasIndenizatorias.ts`
  - ✅ Edge Functions: `generate-verba-indenizatoria-doc`, `verba-indenizatoria-query`, `send-verba-indenizatoria-notification`
  - ✅ Componentes: VIBatchGenerateDialog, VIDocumentPreview, VITimelineLog
  - ✅ Migrations: d4sign_config, d4sign_document_templates, verba_indenizatoria_documents, verba_indenizatoria_logs

### Cockpit GA
- **Rotas**: `/cockpit/*`
- Módulo comercial/logística com KPIs do Datalake (SQL Server via DAB)

---

## Arquivos Críticos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `docs/PLANEJAMENTO_ESTRATEGICO_2026.md` | **NORTE ESTRATÉGICO** — ler antes de planejar qualquer feature |
| `src/App.tsx` | Todas as rotas da aplicação |
| `src/contexts/AuthContext.tsx` | Auth, roles, permissões |
| `src/contexts/CompanyContext.tsx` | Empresa selecionada (multi-company) |
| `src/components/layout/AppleNav.tsx` | Navegação principal |
| `src/integrations/supabase/types.ts` | Tipos gerados do Supabase |
| `src/lib/types.ts` | Tipos compartilhados do frontend |
| `supabase/config.toml` | Config do Supabase local |
| `docs/PRD.md` | Requisitos completos do produto |
| `docs/TECHNICAL.md` | Documentação técnica detalhada |

---

## Regras de Segurança

- Nunca expor `service_role` key no frontend
- Sempre habilitar RLS em novas tabelas
- Usar parênteses explícitos em políticas RLS com `OR`
- Dados sensíveis (verbas, salários, CPF) → apenas via Edge Function com `service_role`
- Nunca incluir dados de outras empresas em queries do frontend

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

5. **Só então** fazer push para `main` → Vercel faz deploy automático em produção

> **Atenção:** o push para `main` aciona deploy imediato em produção para o Grupo Arantes.
> Sempre confirmar com o usuário antes de fazer `git push`.

---

## Comandos Úteis

```bash
npm run dev          # Dev server (porta 8080, fallback 8081)
npm run build        # Build de produção
npm run preview      # Preview do build local
npm run lint         # Lint

supabase functions deploy <nome>   # Deploy de Edge Function
supabase db push                   # Aplicar migrations
```
