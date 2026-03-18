# GA 360 — Guia para Claude Code

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

## Skills Disponíveis (usar SEMPRE que aplicável)

- `ga360-dev` — criar/editar/refatorar qualquer arquivo do GA 360
- `ga360-features` — planejar/especificar nova funcionalidade
- `ga360-domain` — dúvidas de negócio/processo do Grupo Arantes
- `ga360-review` — code review de componentes/hooks/edge functions
- `ga360-ux` — melhorias de interface e usabilidade
- `ga360-tests` — testes unitários/integração

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
  - ⏳ Pendente: `generate-verba-indenizatoria-doc`, `verba-indenizatoria-query`, `send-verba-indenizatoria-notification`
  - ⏳ Pendente: VIBatchGenerateDialog, VIDocumentPreview, VITimelineLog
  - ⏳ Pendente: migrations (tabelas d4sign_config, d4sign_document_templates, verba_indenizatoria_documents, verba_indenizatoria_logs)

### Cockpit GA
- **Rotas**: `/cockpit/*`
- Módulo comercial/logística com KPIs do Datalake (SQL Server via DAB)

---

## Arquivos Críticos

| Arquivo | Responsabilidade |
|---------|-----------------|
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
