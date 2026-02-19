# GA 360 — Documentação de UX

> **Versão:** 1.0  
> **Última atualização:** 2026-02-19  
> **Produto:** GA 360 (CRESCER+)  
> **Organização:** Grupo Arantes

---

## 1. Visão Geral da Experiência

### 1.1 Filosofia de Design

O GA 360 segue uma abordagem de **design corporativo moderno** com ênfase em:

- **Clareza hierárquica:** Informações organizadas por prioridade visual, com KPIs em destaque
- **Progressive disclosure:** Detalhes expandidos sob demanda, evitando sobrecarga cognitiva
- **Consistência de padrões:** Mesmos componentes (cards, tabs, modais) usados em todos os módulos
- **Dark/Light mode:** Suporte completo a temas claro e escuro via toggle
- **Feedback imediato:** Toast notifications (Sonner) para todas as ações, estados de loading consistentes

### 1.2 Design System

| Aspecto | Implementação |
|---------|---------------|
| **Component Library** | shadcn/ui (baseado em Radix UI) |
| **Estilização** | Tailwind CSS com variáveis CSS para theming |
| **Ícones** | Lucide React (consistente em toda app) |
| **Tipografia** | Inter (Regular/SemiBold) |
| **Gráficos** | Recharts |
| **Animações** | CSS transitions (fade-in, slide-up) com staggered delays |
| **Responsividade** | Mobile-first com breakpoints `sm`, `md`, `lg` |

### 1.3 Paleta de Cores

| Uso | Descrição | Aplicação |
|-----|-----------|-----------|
| **Primary** | Azul — ações principais, links, estados ativos | Botões primários, nav ativa, badges |
| **Secondary** | Teal — ações secundárias | Backgrounds suaves, pills de nav |
| **Accent** | Âmbar/Dourado — destaques | Badges de prioridade média, alertas |
| **Destructive** | Vermelho — erros e ações destrutivas | Delete, atrasados, erro de formulário |
| **Warning** | Amarelo — atenção | Em risco, vencimentos próximos |
| **Success** | Verde — sucesso | Concluído, check de presença |
| **Muted** | Cinza — informação secundária | Textos auxiliares, placeholders |

---

## 2. Arquitetura de Navegação

### 2.1 Estrutura Geral

```
┌──────────────────────────────────────────────────────────┐
│  Top Navigation Bar (AppleNav) — fixo, h-14, glassmorphism │
│  [Logo] [Dashboard] [Reuniões▾] [Processos] [Tarefas]    │
│  [OKRs] [Governança] [Trade] [Analytics] [Gamificação]   │
│  [Relatórios] [Admin*]   [🔍] [🐛] [🌙] [👤 Avatar▾]   │
├──────────────────────────────────────────────────────────┤
│  Company Selector Bar — fixo, segunda barra               │
│  [🏢 Todas as Empresas ▾]                                 │
├──────────────────────────────────────────────────────────┤
│                                                          │
│                    Área de Conteúdo                       │
│                   (pt-28 para offset)                    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Navegação Desktop (≥ 1024px)

- **Estilo:** Pill-shaped links horizontais com efeito de hover (`bg-secondary/50`)
- **Estado ativo:** Background `bg-secondary` com `text-foreground`
- **Sub-menus:** Dropdown com `ChevronDown` (ex: "Reuniões" → Reuniões + Calendário)
- **Admin:** Visível apenas para usuários com permissão `admin.view` via `RoleGuard`

### 2.3 Navegação Mobile (< 1024px)

- **Trigger:** Ícone hamburger (`Menu`/`X` toggle) no canto esquerdo
- **Overlay:** Full-screen com `backdrop-blur-sm` e `bg-background/80`
- **Animação:** Slide-up (`animate-slide-up`)
- **Sub-menus:** Acordeão colapsável (`Collapsible`) com rotação de chevron
- **Touch targets:** `rounded-xl`, tamanho mínimo adequado
- **Auto-close:** Navegar para qualquer link fecha o menu

### 2.4 Elementos Fixos (Todas as Telas)

| Elemento | Posição | Descrição |
|----------|---------|-----------|
| **Busca** | Top-right | Toggle que expande barra de busca abaixo do nav |
| **Bug Report** | Top-right | Abre modal de reporte de bug |
| **Theme Toggle** | Top-right | Alterna dark/light mode (Sun/Moon com transição) |
| **Avatar Menu** | Top-right | Dropdown: Meu Perfil, Meu Dashboard, Alterar Senha, Sair |
| **Company Selector** | Segunda barra | Select dropdown com ícone Building2 |

### 2.5 Mapa de Rotas

```
/auth                           → Login / Cadastro (público)
/reset-password                 → Recuperação de senha (público)
/confirm-attendance             → Confirmação de presença (público, token)
/change-password                → Alteração de senha

/dashboard                      → Dashboard Executivo
/dashboard/me                   → Dashboard Pessoal

/reunioes                       → Lista de Reuniões (4 tabs)
/reunioes/:id/executar          → Execução de Reunião
/calendario                     → Calendário Corporativo

/processos                      → Processos (3 tabs)
/tarefas                        → Tarefas
/okrs                           → OKRs (2 tabs)

/governanca-ec                  → Dashboard Governança EC
/governanca-ec/:areaSlug        → Cards da Área
/governanca-ec/:slug/:cardId    → Detalhe do Card
/governanca-ec/pessoas-cultura/qlp → QLP Drill-Down
/governanca-ec/auditoria/estoque   → Auditoria de Estoque
/governanca-ec/auditoria/estoque/:id → Execução de Auditoria

/trade                          → Trade Marketing (4 tabs)
/analytics                      → Analytics
/gamificacao                    → Gamificação (4 tabs)
/relatorios                     → Relatórios IA

/admin                          → Hub Administrativo
/admin/estrutura                → Estrutura Organizacional
/admin/areas                    → Áreas
/admin/users                    → Usuários
/admin/empresas                 → Empresas
/admin/permissions              → Permissões Granulares
/admin/settings                 → Configurações
/admin/employees                → Funcionários Externos
/admin/governanca-ec            → Config Governança EC
/admin/datalake                 → Integração Datalake
/admin/bugs                     → Bugs e Melhorias

/profile                        → Editar Perfil
```

---

## 3. Perfis de Usuário & Controle de Acesso

### 3.1 Roles e Hierarquia

```
super_admin ─── Acesso irrestrito, bypass de todas as verificações
    │
    ceo ─────── Visão consolidada, configuração geral do sistema
    │
    diretor ─── Gestão por área/unidade, governança, aprovações
    │
    gerente ─── Execução operacional, condução de rituais
    │
    colaborador ─ Participação, execução de tarefas atribuídas
```

### 3.2 Modelo de Permissões

O sistema opera em **três camadas de permissão**:

| Camada | Escopo | Mecanismo |
|--------|--------|-----------|
| **Módulo** | Acesso on/off por módulo do sistema | `user_permissions` (can_view/create/edit/delete) |
| **Card Governança** | Permissão granular por card EC | `ec_card_permissions` (can_view/fill/review/manage) |
| **Empresa** | Acesso multi-company | `user_companies` (individual ou todas) |

### 3.3 Comportamento Visual por Permissão

| Cenário | Comportamento UX |
|---------|------------------|
| Sem permissão de módulo | Item não aparece no menu OU redireciona para `/dashboard` |
| Sem permissão de card | Card aparece com `opacity-50 cursor-not-allowed`, click bloqueado |
| Sem permissão de card (página direta) | Tela de bloqueio com `ShieldAlert` + botão de voltar |
| Admin sem permissão | Link "Admin" não aparece na navegação |
| Dashboard | Sempre acessível para todos os usuários ativos |

---

## 4. Fluxos de Usuário Detalhados

### 4.1 Autenticação

#### Login
```
[Tela de Login]
    │
    ├─ Email + Senha → Validação Zod
    │     │
    │     ├─ [2FA ativo] → Tela de código → Verificação
    │     │                                      │
    │     └─ [2FA desativado] ───────────────────┤
    │                                             │
    │                          Carrega perfil ◄───┘
    │                          Carrega roles
    │                          Carrega permissões
    │                               │
    │                          → /dashboard
    │
    ├─ "Esqueci minha senha" → /reset-password → Email com link
    │
    └─ Tab "Cadastro" → Formulário com validação
         │
         └─ ?invite=<token> → Pré-preenche dados do convite
```

**Componentes visuais:**
- Card centralizado na tela com logo CRESCER+
- Tabs Login / Cadastro
- Validação inline por campo (Zod)
- Spinner no botão durante submit
- Alert para mensagens de erro

#### Primeiro Acesso (Convite)
1. Usuário recebe e-mail com link `?invite=<token>`
2. Token é validado contra `user_invites`
3. Formulário de cadastro é pré-preenchido com dados do convite
4. Após cadastro, convite é marcado como aceito

### 4.2 Dashboard Executivo

**Layout:** Grid responsivo com 3 seções verticais

```
┌─────────────────────────────────────────────┐
│ Dashboard Executivo                          │
├─────────────┬──────────────┬────────────────┤
│ Reuniões    │ Tarefas      │ Tarefas        │
│ do Mês      │ Concluídas   │ Atrasadas      │
│ [count]     │ [count] [%]  │ [count] ⚠️     │
├─────────────┴──────┬───────┴────────────────┤
│ Progresso por      │ Atividade              │
│ Pilar              │ Recente                │
│ [gráfico]          │ [lista]                │
├────────────────────┴────────────────────────┤
│ Próximas Reuniões        │ MCI Radar        │
│ [3 cards clicáveis]      │ [gauge circular] │
└──────────────────────────┴──────────────────┘
```

**Interações:**
- Filtro automático por empresa selecionada no Company Selector
- Cards de reunião clicáveis → navega para execução
- Animação staggered nas cards (fade-in-up)
- Estado de loading: spinner centralizado

### 4.3 Dashboard Pessoal (`/dashboard/me`)

**Conteúdo personalizado para o usuário logado:**

| Seção | Dados |
|-------|-------|
| **Stats Cards** | Total de tarefas, Tarefas do dia, Concluídas no mês, Reuniões pendentes, ATAs pendentes |
| **Tarefas Prioritárias** | Até 4 tarefas high/critical ou com vencimento hoje/amanhã. Badge colorido por prioridade |
| **Reuniões de Hoje** | Lista de reuniões agendadas para o dia atual |

### 4.4 Reuniões

#### Listagem (`/reunioes`)

**4 tabs:**

| Tab | Conteúdo |
|-----|----------|
| **Dashboard** | `MeetingDashboard` — visão geral com KPIs de reuniões |
| **Confirmações** | `ConfirmationDashboard` — tracking de confirmação de presença |
| **Reuniões** | Lista de `MeetingCard` — cards individuais de reunião |
| **Salas** | `MeetingRoomsList` — gestão de salas de reunião |

**Ações:**
- Botão "Nova Reunião" → abre `MeetingFormDialog` (modal)
- Card de reunião → ações: Iniciar (navega `/reunioes/:id/executar`), Ver ATA, Editar
- Empty state: card centralizado com mensagem

#### Execução de Reunião (`/reunioes/:id/executar`)

**Layout:** Workspace 3 colunas (sem tabs/steps — tudo visível simultaneamente)

```
┌─────────────┬──────────────────┬─────────────────┐
│   PAUTAS    │   TRANSCRIÇÃO    │  PARTICIPANTES   │
│             │                  │                  │
│ □ Pauta 1   │ [Transcrição     │ 👤 Nome — ✓     │
│ ☑ Pauta 2   │  em tempo real   │ 👤 Nome — ⏳    │
│ □ Pauta 3   │  via IA]         │ 👤 Nome — ✗     │
│             │                  │                  │
│ Progresso:  │                  │ 📋 Descrição    │
│ 1/3 ████░░  │                  │ 🔗 Link Teams   │
├─────────────┴──────────────────┴─────────────────┤
│              [Finalizar Reunião]                  │
└──────────────────────────────────────────────────┘
```

**Fluxo de execução:**
1. Ao entrar, status muda automaticamente para "Em Andamento"
2. Marcar pautas como feitas (toggle checkbox, persiste em tempo real)
3. Transcrição via IA acontece em tempo real (se habilitada)
4. "Finalizar Reunião" → muda status para "Concluída"
5. Se transcrição existe → `AlertDialog` oferece gerar ATA via IA
6. Se transcrição é obrigatória e não existe → bloqueia finalização

#### Confirmação de Presença (`/confirm-attendance`)

**Página pública (sem login necessário):**

1. Link recebido por e-mail: `?token=xxx`
2. Se `&action=decline` → recusa automática
3. Senão → card centralizado com opções Confirmar / Recusar
4. Após ação → card de resultado (✓ verde ou ✗ vermelho) com dados da reunião

### 4.5 Tarefas

**Layout:** Barra de filtros + lista de cards

```
┌──────────────────────────────────────────────┐
│ Tarefas                    [+ Nova Tarefa]   │
├──────────────────────────────────────────────┤
│ 🔍 Buscar... │ Status ▾ │ Prioridade ▾     │
├──────────────────────────────────────────────┤
│ □ Tarefa 1  [Alta]  [Pendente]  📅 20/02    │
│ ☑ Tarefa 2  [Média] [Concluída] 📅 18/02   │
│ □ Tarefa 3  [Crítica][Em Andamento] 📅 22/02│
└──────────────────────────────────────────────┘
```

**Interações:**
- **Busca textual** em tempo real
- **Filtros:** Status (todos/pendente/em andamento/concluída/cancelada) e Prioridade (todos/baixa/média/alta/crítica)
- **Criação:** Botão abre `TaskFormDialog` (modal com formulário completo)
- **Edição:** Ícone de edição em cada linha abre dialog em modo de edição
- **Toggle inline:** Checkbox para marcar/desmarcar conclusão
- **Badges coloridos:** Prioridade (Crítica/Alta = vermelho, Média = âmbar, Baixa = cinza) e Status

### 4.6 Processos

**3 tabs:**

| Tab | Conteúdo |
|-----|----------|
| **Dashboard** | `ProcessDashboard` — KPIs e visão geral |
| **Processos** | `ProcessList` — CRUD de processos |
| **Histórico** | `ProcessExecutionHistory` — execuções passadas |

**Gate:** Se nenhuma empresa selecionada → Alert com ícone Building2 pedindo seleção

**Execução de processo:** Checklist interativo, comentários por item, criação de tarefas vinculadas, upload de anexos

### 4.7 Calendário

**Layout:** Grid mensal com indicadores

```
┌──────────────────────────────────────┐
│  ◀  Fevereiro 2026  ▶               │
├──┬──┬──┬──┬──┬──┬──┬────────────────┤
│ D│ S│ T│ Q│ Q│ S│ S│                │
├──┼──┼──┼──┼──┼──┼──┤                │
│  │  │  │  │  │  │ 1│                │
│ 2│ 3│ 4│ 5│ 6│ 7│ 8│  ← dots por   │
│ 9│10│🔵│12│13│14│15│     tipo de    │
│16│17│18│🟣│🟡│21│22│     reunião    │
│23│24│25│26│27│28│  │                │
└──┴──┴──┴──┴──┴──┴──┴────────────────┘
```

**Cores dos indicadores:**
- 🔵 Estratégica (primary)
- 🟣 Tática (secondary)  
- 🟡 Operacional (accent)
- Outros: chart-4

**Interações:**
- Navegação por mês (botões ◀ ▶)
- Click em dia com reunião → `Dialog` com detalhes (platform, status, recorrência, duração, sala, descrição)
- Badges de status: Agendada (secondary), Em andamento (default), Concluída (outline), Cancelada (destructive)

### 4.8 OKRs

**2 tabs:**

| Tab | Conteúdo |
|-----|----------|
| **Dashboard** | `OKRDashboard` — visão geral de progresso |
| **Objetivos** | `ObjectivesList` — lista hierárquica de objetivos e key results |

**Gate:** Requer empresa selecionada (mesmo padrão de Processos)

**Estrutura de dados:**
- Objetivos têm hierarquia (parent_id) e nível  
- Key Results vinculados com meta, atual, início, peso, unidade
- Histórico de atualizações de KRs

### 4.9 Governança EC

#### Dashboard (`/governanca-ec`)

```
┌──────────────────────────────────────────────┐
│ KPIs (5 colunas)                             │
│ [Pendentes] [Andamento] [Risco] [Atrasados] [Concluídos] │
├──────────────────────────────────────────────┤
│ ⚠️ Próximos Vencimentos (7 dias)            │
│ [status] Card X — competência — 📅 data      │
│ [status] Card Y — competência — 📅 data      │
├──────────────────────────────────────────────┤
│ Áreas (5 colunas)                            │
│ [🛡 Governança] [💰 Financeiro] [👥 P&C]    │
│ [⚖ Jurídico]   [🔍 Auditoria]               │
└──────────────────────────────────────────────┘
```

**KPIs:** Cards com borda lateral colorida (cinza/azul/amarelo/vermelho/verde)

**Interações:**
- Click em "Próximos Vencimentos" → navega para card específico
- Click em área → navega para `/governanca-ec/:slug`

#### Área (`/governanca-ec/:areaSlug`)

**Ferramentas:**
- Busca textual + filtro de status
- Toggle Grid/List view
- Botão "Novo Card" (apenas super_admin)

**Cards:** Renderizados por `ECCard` com:
- Status badge (colorido)
- Contagem de tarefas pendentes
- Periodicidade (badge)
- Responsável (avatar + nome)
- Data de vencimento e última atualização
- **Permissão:** Cards sem `can_view` ficam `opacity-50 cursor-not-allowed`
- **Ações:** Menu dropdown (Editar/Excluir) visível apenas para quem tem `can_manage`

**Cards especiais:**
- "Auditoria de Estoque" → navega para `/governanca-ec/auditoria/estoque`
- "QLP" → navega para `/governanca-ec/pessoas-cultura/qlp`

#### Detalhe do Card (`/governanca-ec/:areaSlug/:cardId`)

- **Permission gate:** Verifica `hasCardPermission(cardId, 'view')`
- Interface com tabs (summary, tarefas, etc.) via `ECCardDetail`
- Workflow de status: Pendente → Em Andamento → Concluído → Revisado
- Campos manuais, checklists, evidências (arquivos/links), comentários

#### QLP (`/governanca-ec/pessoas-cultura/qlp`)

- **Permission gate:** Busca card QLP e verifica `can_view`
- Drill-down da força de trabalho por empresa e departamento
- Visualização hierárquica interativa

#### Auditoria de Estoque

**Fase 1 — Início (`/governanca-ec/auditoria/estoque`):**
- Tab "Nova Auditoria" → `StockAuditWizard`
- Tab "Histórico" → lista de auditorias anteriores

**Fase 2 — Execução (`/governanca-ec/auditoria/estoque/:auditId`):**
- Se em andamento → continua wizard
- Se concluída → exibe resumo com:
  - KPIs: Total contado, OK (verde), Divergente (amarelo), Recontado (azul)
  - Dados do testemunha (nome + CPF)
  - Banner de movimentação de estoque
  - Geração e envio de relatório PDF

### 4.10 Trade Marketing

**4 tabs:**

| Tab | Status | Conteúdo |
|-----|--------|----------|
| **Auditorias** | Placeholder | "Em desenvolvimento" |
| **Inventário** | ✅ Ativo | `InventoryDashboard` — indústrias, materiais, movimentações |
| **PDV** | Placeholder | "Em desenvolvimento" |
| **Relatórios** | Placeholder | "Em desenvolvimento" |

**Tab labels:** Ocultos em telas pequenas (`hidden sm:inline`), ícones sempre visíveis

### 4.11 Analytics

**Estrutura:**
1. **Filtros:** Período (date range), Empresa, Área
2. **KPI Grid:** Cards dinâmicos filtrados
3. **4 tabs de detalhe:**

| Tab | Conteúdo |
|-----|----------|
| **Visão Geral** | `MeetingsAnalytics` + `TasksAnalytics` compactos lado a lado |
| **Reuniões** | `MeetingsAnalytics` expandido |
| **Tarefas** | `TasksAnalytics` expandido |
| **Participação** | `ParticipationAnalytics` |

### 4.12 Gamificação

**Estrutura:**
- **Perfil** (card resumo): XP, nível, pontos atuais
- **4 tabs:**

| Tab | Conteúdo |
|-----|----------|
| **Ranking** | `GamificationLeaderboard` — classificação geral |
| **Conquistas** | `GamificationBadges` — todas as badges disponíveis |
| **Minhas Badges** | `GamificationBadges` — apenas conquistadas |
| **Histórico** | `GamificationHistory` — log de pontuações |

### 4.13 Relatórios IA

**Layout:** 2 colunas (`lg:grid-cols-2`)

```
┌──────────────────┬──────────────────┐
│ Assistente IA    │ Visualizador     │
│                  │                  │
│ [Campo de prompt]│ [Relatório       │
│ [Exemplos]       │  renderizado]    │
│ [Gerar]          │                  │
│                  │ [📄 Exportar PDF]│
└──────────────────┴──────────────────┘
```

**Fluxo:**
1. Usuário digita prompt ou seleciona exemplo
2. Chama OpenAI via Edge Function
3. Resultado exibido no visualizador
4. Opção de exportar para PDF (via jsPDF)

### 4.14 Perfil

**Layout:** Card centralizado com formulário

**Campos:**
- Avatar (clicável para upload, overlay com ícone Camera)
- Nome, Sobrenome
- Área (dropdown das áreas do Supabase)
- Telefone (validação formato brasileiro `+5511999999999`)
- Botão "Alterar Senha" → navega para `/change-password`

---

## 5. Painel Administrativo

### 5.1 Hub Admin (`/admin`)

**Layout:** Grid de cards (`md:2 cols`, `lg:3 cols`) com animação staggered

| Card | Ícone | Descrição |
|------|-------|-----------|
| **Estrutura Organizacional** | Building2 | Empresas e áreas hierárquicas |
| **Usuários** | Users | Criar, editar, ativar/desativar |
| **Permissões Granulares** | Shield | Módulos, cards e empresas por usuário |
| **Funcionários Externos** | UserCheck | Sincronização com RH externo |
| **Integração Datalake** | Database | Conexões, queries, bindings |
| **Bugs e Melhorias** | Bug | Reports da equipe |
| **Configurações Gerais** | Settings | SMTP, OpenAI, WhatsApp, Stock Audit |

### 5.2 Gestão de Usuários (`/admin/users`)

**Layout vertical:**

```
┌──────────────────────────────────────────────┐
│ [Total: 42]  [Ativos: 38 ✓]  [Inativos: 4 ✗]│
├──────────────────────────────────────────────┤
│ 🔍 Busca │ Empresa▾ │ Role▾ │ Área▾ │Status▾│
├──────────────────────────────────────────────┤
│ 👤 Nome    │ Empresa  │ Área  │ [role] │ ✏️  │
│ 👤 Nome    │ Empresa  │ Área  │ [role] │ ✏️  │
│ 👤 Nome    │ [inativo]│ Área  │ [role] │ ✏️  │
└──────────────────────────────────────────────┘
```

**Edição:** Dialog com campos: nome, área, empresa, ativo/inativo, role, telefone
**Regra:** Super admin não pode remover sua própria role super_admin

### 5.3 Gestão de Permissões (`/admin/permissions`)

**Layout master-detail (1/4 + 3/4):**

```
┌──────────────┬───────────────────────────────────┐
│ Buscar...    │ 👤 Nome do Usuário                │
│              │ Empresa: XXX                       │
│ ○ Usuário A  │                                    │
│ ● Usuário B  ├─[Módulos]──[Governança EC]──[Empresas]─│
│ ○ Usuário C  │                                    │
│ ○ Usuário D  │ ┌─ Módulos ─────────────────────┐ │
│              │ │ Reuniões          [on/off]     │ │
│              │ │ Calendário        [on/off]     │ │
│              │ │ Tarefas           [on/off]     │ │
│              │ │ Processos         [on/off]     │ │
│              │ │ Trade Marketing   [on/off]     │ │
│              │ │ Relatórios        [on/off]     │ │
│              │ │ Governança EC     [on/off]     │ │
│              │ └────────────────────────────────┘ │
│              │                   [Salvar Alterações]│
└──────────────┴───────────────────────────────────┘
```

**Tab "Governança EC" — Matriz de permissões por card:**

```
┌── Ações em Lote ─────────────────────────────────┐
│ [Visualizar todos] [Preencher todos]             │
│ [Revisar todos] [Gerenciar todos] [Limpar todos] │
├──────────────────────────────────────────────────┤
│ 🛡 Auditoria                          1 cards   │
│ CARD               │ VIS │ PRE │ REV │ GER     │
│ Auditoria Estoque  │  ○  │  ○  │  ○  │  ○      │
├──────────────────────────────────────────────────┤
│ 👥 Pessoas & Cultura                   1 cards   │
│ CARD               │ VIS │ PRE │ REV │ GER     │
│ QLP                │  ✓  │  ○  │  ○  │  ○      │
└──────────────────────────────────────────────────┘
```

**Tab "Empresas":**
- Master checkbox "Todas as empresas" 
- Se desmarcado → checkboxes individuais por empresa

### 5.4 Estrutura Organizacional (`/admin/estrutura`)

**Layout:** Grid de cards de empresas com áreas aninhadas

**Cada card de empresa:**
- Ícone colorido (cor da empresa) + Nome + CNPJ
- Botões Editar/Excluir
- Seção "Áreas" com `AreaTreeView` hierárquica (suporte a `parent_id`)
- Botão "Nova Área" por empresa

**CRUD de Empresa:** Dialog com nome, CNPJ, cor, logo, flag "auditável"
**CRUD de Área:** Dialog com nome, centro de custo, área pai

---

## 6. Padrões de Interação Recorrentes

### 6.1 Componentes UI

| Padrão | Uso | Componente |
|--------|-----|------------|
| **Tabs** | Organização de conteúdo por módulo | `Tabs`/`TabsList`/`TabsContent` (shadcn) |
| **Card Grid** | KPIs, dashboards, admin hub | `Card` com grid responsivo |
| **Modal/Dialog** | CRUD de entidades | `Dialog`/`AlertDialog` (shadcn) |
| **Table/List** | Listagens com dados | Cards custom ou linhas de dados |
| **Filtros** | Busca + selects combinados | `Input` + `Select` em barra horizontal |
| **Toggle** | On/off de configurações | `Switch` (shadcn) |
| **Checkbox** | Seleção múltipla/completar | `Checkbox` (shadcn) |
| **Badge** | Status, prioridade, roles | `Badge` com variantes de cor |
| **Avatar** | Foto do usuário ou iniciais | `Avatar`/`AvatarFallback` (initiais) |
| **Toast** | Feedback de ações | Sonner — sucesso (verde), erro (vermelho) |
| **Skeleton** | Estado de loading | `Skeleton` (shimmer) |
| **BackButton** | Navegação de retorno | `ArrowLeft` + texto "Voltar" |
| **DropdownMenu** | Ações contextuais | Três pontos (`MoreVertical`) → menu |
| **AlertDialog** | Confirmações destrutivas | "Tem certeza?" com Cancelar/Confirmar |

### 6.2 Estados de Loading

| Tipo | Uso |
|------|-----|
| **Spinner centralizado** | `Loader2` com `animate-spin` — carregamento de página |
| **Skeleton shimmer** | `Skeleton` — cards/listas em carregamento |
| **Button spinner** | `Loader2` inline no botão durante submit |
| **Progress badge** | Barra de progresso para wizard steps |

### 6.3 Feedback & Notificações

| Tipo | Implementação |
|------|---------------|
| **Sucesso** | Toast verde via Sonner (auto-dismiss ~3s) |
| **Erro** | Toast vermelho com mensagem descritiva |
| **Validação** | Mensagem inline abaixo do campo (vermelho) |
| **Alerta** | `Alert` component com ícone e call-to-action |
| **Confirmação** | `AlertDialog` para ações destrutivas |

### 6.4 Animações

| Animação | Descrição | Uso |
|----------|-----------|-----|
| `animate-fade-in` | Opacity 0→1 | Entrada de componentes |
| `animate-fade-in-up` | Opacity + translateY | Cards de dashboard |
| `animate-slide-up` | TranslateY de baixo | Menu mobile overlay |
| Staggered delay | `100ms × index` | Cards em grid |
| Rotate transition | `rotate(180deg)` | Chevron em sub-menus |
| Scale + opacity | Cross-fade | Theme toggle Sun/Moon |

---

## 7. Responsividade

### 7.1 Breakpoints

| Breakpoint | Largura | Comportamento |
|------------|---------|---------------|
| **Base** (mobile) | < 640px | 1 coluna, nav hamburger, tabs com ícones |
| **sm** | ≥ 640px | Labels de tab aparecem |
| **md** | ≥ 768px | 2 colunas em grids |
| **lg** | ≥ 1024px | Nav horizontal, 3+ colunas, layout completo |

### 7.2 Adaptações por Tela

| Elemento | Mobile | Desktop |
|----------|--------|---------|
| **Navegação** | Hamburger + overlay vertical | Pills horizontais |
| **Grids** | 1 coluna | 2-5 colunas conforme módulo |
| **Tabs** | Ícones apenas | Ícone + texto |
| **Tabelas** | Cards empilhados | Linhas horizontais |
| **Filtros** | Empilhados verticalmente | Barra horizontal |
| **Modais** | Full-width | Max-width centralizado |

---

## 8. Acessibilidade

| Aspecto | Implementação |
|---------|---------------|
| **Semântica** | Componentes Radix UI com ARIA roles |
| **Teclado** | Navegação por tab em todos os componentes interativos |
| **Contraste** | Temas light/dark com contraste adequado |
| **Screen reader** | Labels em botões de ícone (ex: "Alternar tema") |
| **Motion** | `prefers-reduced-motion` respeitado |
| **Focus** | Ring de foco visível nos componentes shadcn |

---

## 9. Fluxos de Erro

| Cenário | Comportamento |
|---------|---------------|
| **API falhou** | Toast de erro com mensagem descritiva |
| **Validação de form** | Mensagem inline vermelha abaixo do campo |
| **Sem permissão** | Tela de bloqueio com ShieldAlert ou redirect |
| **Sem empresa** | Alert com ícone e orientação para selecionar empresa |
| **Sem dados** | Empty state com ícone, mensagem e CTA |
| **404** | Página NotFound com link para home |
| **Sem conexão** | React Query retry automático (3 tentativas) |

---

## 10. Glossário de Termos

| Termo | Significado |
|-------|-------------|
| **Card (Governança)** | Entregável periódico do Escritório Central |
| **Competência** | Período de referência (ex: "2026-02") |
| **ATA** | Ata de reunião gerada por IA |
| **QLP** | Quadro de Lotação de Pessoal |
| **EC** | Escritório Central (Governança Corporativa) |
| **MCI** | Meta de Conclusão Intermediária |
| **KR** | Key Result (Resultado-Chave de OKR) |
| **PDV** | Ponto de Venda (Trade Marketing) |
| **RLS** | Row Level Security (segurança no banco) |
| **RBAC** | Role-Based Access Control |
| **2FA** | Two-Factor Authentication |

---

*Documento gerado a partir da análise do código-fonte em 2026-02-19.*
