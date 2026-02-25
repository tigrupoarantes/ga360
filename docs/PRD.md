# GA 360 — Product Requirements Document (PRD)

> **Versão:** 1.1  
> **Última atualização:** 2026-02-25  
> **Produto:** GA 360 (CRESCER+)  
> **Organização:** Grupo Arantes  
> **Status:** Em produção

---

## 1. Visão Geral do Produto

### 1.0 Atualizações recentes (produção)

- **Governança EC:** automatização de permissões granulares de visualização por card ao habilitar módulo `governanca` para um usuário.
- **Governança EC:** backfill para usuários já existentes e propagação automática para novos cards ativos.
- **Controle PJ:** disponibilizados scripts operacionais de sincronização (`external_employees` → `pj_contracts`) e limpeza segura por empresa.
- **Estabilidade de acesso:** ajuste de fallback no frontend para evitar tela vazia em onboarding de novos usuários com governança habilitada.

### 1.1 Descrição

GA 360 é um portal corporativo para gerenciamento do **Planejamento Estratégico anual**, centralizando reuniões, processos, tarefas e execução de Trade Marketing, com IA integrada para transcrição e geração automática de ATA (minutas) inteligentes. Projetado para CEOs, diretores e gerentes do Grupo Arantes, fornece controles configuráveis pelo CEO, dashboards executivos e operacionais, e trails de auditoria completos.

### 1.2 Público-alvo

| Perfil | Responsabilidades |
|--------|-------------------|
| **CEO / Super Admin** | Configuração geral, visão consolidada, aprovação de ATAs, gestão de permissões |
| **Diretores** | Gestão de tópicos, reuniões e processos por área |
| **Gerentes** | Execução de tarefas, condução de rituais, checagem de processos |
| **Colaboradores Especiais** | Execução de tarefas atribuídas, comentários em pautas |
| **Equipe de campo** | Trade Marketing: auditorias, evidências de PDV |

### 1.3 Proposta de Valor

Uma plataforma **100% configurável pelo CEO** que une rituais de governança (reuniões e processos) a execução operacional e auditoria de campo, com IA que transforma áudio em transcrição, identifica decisões/ações e gera ATAs aprováveis automaticamente — reduzindo tempo de registro, aumentando aderência e garantindo rastreabilidade.

---

## 2. Requisitos Funcionais (MoSCoW)

### 2.1 Must Have (Essenciais)

#### Autenticação e Autorização
- Login por e-mail + senha; recuperação e primeiro acesso com definição de senha
- Gestão de perfis (`super_admin`, `ceo`, `diretor`, `gerente`, `colaborador`) com RBAC configurável pelo CEO
- Permissões granulares por módulo (CRUD por sistema: dashboard, meetings, tasks, processes, trade, reports, admin, governança, calendar)
- Sessões JWT com refresh; sistema de convites com token
- 2FA via e-mail e WhatsApp (implementado, temporariamente desabilitado)

#### Reuniões
- Listagem filtrável (tipo, data, área, status)
- Criação de reunião: tipo, participantes, área, data/hora, tópico vinculado, pautas padrão editáveis, recorrência
- Configuração de IA por reunião (transcrição obrigatória / opcional / desativada)
- Execução de reunião: marcar pautas (Feito/Não Feito), comentários, adicionar pautas
- Gravação áudio via browser (MediaRecorder) e upload seguro
- Transcrição automática (ElevenLabs Scribe / serviço STT) e revisão antes de encerrar
- Geração automática de ATA inteligente (resumo, decisões, tarefas, prazos, responsáveis) via LLM
- Aprovação de ATA, geração de PDF e armazenamento no histórico
- Histórico completo (transcrição, ATA, pautas, tarefas, presenças, revisões)
- Salas de reunião com links de plataformas (Teams, Zoom, Google Meet, etc.)
- Confirmação de presença via e-mail com token

#### Tarefas
- Criação/atribuição com nome, descrição, responsável, prazo, prioridade, categoria
- Vista de lista com filtros (área, prazo, status, responsável)
- Detalhe de tarefa com histórico, comentários, anexos, vínculo a reunião/processo/trade/governança

#### Processos
- Criação e execução de processos com frequência, checklists, responsáveis, anexos
- Execução com marcação de itens, comentários e criação de tarefas
- Histórico e linha do tempo de execuções

#### Dashboards e KPIs
- Dashboard executivo: visão consolidada com filtros por período e unidade/área
- Dashboard pessoal: tarefas atribuídas, próximos rituais, reuniões pendentes
- KPI cards (reuniões, tarefas, processos, aderência)
- Gráficos e visualizações por área

#### Calendário
- Calendário corporativo com reuniões, processos e deadlines
- Vista mensal com indicadores visuais por tipo

#### Trade Marketing
- Gestão de indústrias, materiais e movimentações de estoque
- Dashboard de inventário com balanço em tempo real
- Auditorias com checklist, fotos, comentários, score (parcialmente implementado)

#### OKRs
- Objetivos hierárquicos com nível, datas, progresso
- Key Results vinculados com meta/atual/início, peso
- Histórico de atualizações de KRs

#### Governança EC (Estratégia Corporativa)
- Áreas de governança (Governança, Financeiro, Pessoas & Cultura, Jurídico, Auditoria)
- Cards de governança com periodicidade, checklists, campos manuais, escopo
- Registros mensais/periódicos com workflow de status
- Permissões por card (view/fill/review/manage)
- Seed automático de `can_view` por card para usuários com módulo governança ativo
- Tarefas vinculadas a cards/registros
- Comentários e evidências (arquivos/links)
- Integração com Datalake externo para dados automatizados

#### Pessoas & Cultura — Controle PJ
- Gestão de contratos PJ com fechamento por competência
- Banco de folgas, logs de e-mail e geração de holerite
- Sincronização de base PJ via `external_employees`
- Procedimento de reset seguro por empresa para operação e treinamentos

#### Auditoria de Estoque (Stock Audit)
- Wizard completo: seleção de unidade → upload de base → geração de amostra → checklist de contagem → finalização → relatório
- Contagem cega, recontagem, causa raiz
- Fotos como evidência

#### Gamificação
- Leaderboard, badges, perfil de pontos
- Histórico de pontuações e níveis
- Condições configuráveis para badges

#### Analytics
- Filtros por data, empresa, área
- KPIs consolidados, análise de reuniões, tarefas e participação

#### Relatórios
- Assistente IA para geração de relatórios (via OpenAI)
- Visualizador e exportação em PDF
- Biblioteca de exemplos de prompts

#### Administração (CEO)
- Gestão de usuários (criar/editar/inativar), importação CSV
- Gestão de áreas hierárquicas (árvore)
- Gestão de empresas (multi-company)
- Permissões granulares por módulo
- Gestão de empregados externos (sincronização com sistemas de RH)
- Configurações: email SMTP, OpenAI, WhatsApp, Stock Audit
- Governança EC: CRUD de cards, conexões datalake, queries, bindings
- Bug reports
- Logs e auditoria

#### Notificações
- Notificações por e-mail para convites, reuniões, confirmação de presença
- Lembretes de reunião automatizados
- Notificações WhatsApp (configurável)

#### Segurança e Conformidade
- Criptografia TLS, logs de auditoria, LGPD compliance
- RLS (Row Level Security) no Supabase para isolamento de dados por empresa
- Controle de acesso por empresa (`user_companies` com flag `all_companies`)

#### Performance
- Paginação, lazy-loading, virtualização de listas
- Cache de consultas com React Query

#### Responsividade
- Suporte para desktop e tablet
- Navegação mobile com menu hamburger

---

### 2.2 Should Have (Importantes, mas não bloqueadores)

- Integração com calendários (Google Calendar, Outlook) para sincronização
- Integração com Zoom/Teams para importar gravações e links de reunião
- Search global (transcrições, ATAs, tarefas) com filtro por data/autor
- WebSocket/real-time updates para status de reuniões e tarefas
- Controle de versão de ATAs e histórico de edits
- Export avançado (PowerPoint, pack de relatórios customizados)
- MFA/SSO (SAML/SSO Azure AD)

### 2.3 Could Have (Desejáveis)

- Streaming de transcrição em tempo real (low-latency)
- Integração com sistemas de ERP/BI para KPIs automáticos
- Mobile app nativo (iOS/Android)
- Templates de ATA customizáveis com LLM-driven tone adjustments
- Multi-idioma para transcrição e interface
- Assistente virtual que sugere pauta priorizada com base em KPIs históricos

### 2.4 Won't Have (Fora do escopo V1)

- Plataforma multi-tenant pública (single-tenant por cliente inicialmente)
- Integração profunda com CRMs/ERPs específicos sem definição no MVP
- Funcionalidades de analytics avançadas com modelos próprios de ML

---

## 3. Histórias de Usuário

| # | História | Módulo |
|---|----------|--------|
| 1 | Como **CEO**, eu quero configurar pilares, tópicos e pautas padrão para garantir consistência no planejamento anual. | Admin |
| 2 | Como **CEO**, eu quero definir regras padrão de transcrição para garantir que reuniões críticas sempre tenham registro. | Admin / Reuniões |
| 3 | Como **Diretor**, eu quero criar reuniões de minha área com pautas predefinidas para padronizar rituais. | Reuniões |
| 4 | Como **Diretor**, eu quero acessar o dashboard da minha unidade para acompanhar progressos e identificar gaps. | Dashboard |
| 5 | Como **Gerente**, eu quero criar e atribuir tarefas durante a execução de reuniões para garantir acompanhamento. | Tarefas / Reuniões |
| 6 | Como **Gerente**, eu quero marcar pautas como Feito/Não Feito e adicionar comentários para manter rastreabilidade. | Reuniões |
| 7 | Como **Colaborador**, eu quero receber tarefas e comentar pautas para colaborar na execução. | Tarefas |
| 8 | Como **Usuário**, eu quero que reunião com transcrição obrigatória não possa ser finalizada sem a transcrição. | Reuniões |
| 9 | Como **Usuário**, eu quero revisar a transcrição e a ATA gerada antes de aprovar para assegurar precisão. | Reuniões |
| 10 | Como **Usuário**, eu quero exportar a ATA aprovada em PDF para comunicação oficial. | Reuniões |
| 11 | Como **CEO**, eu quero auditar logs de ações para investigar mudanças e cumprir governança. | Admin |
| 12 | Como **Analista**, eu quero visualizar KPIs por pilar e área para medir aderência ao planejamento. | Analytics |
| 13 | Como **Fiscal de Trade**, eu quero registrar fotos nas auditorias e gerar score automaticamente. | Trade |
| 14 | Como **Usuário**, eu quero sincronizar reuniões com meu Google Calendar para receber lembretes. | Calendário |

---

## 4. Estrutura de Páginas e Rotas

### 4.1 Navegação Principal

**Layout:** Top bar horizontal (AppleNav) com dropdown para sub-menus.

| Item | Rota | Subitens |
|------|------|----------|
| Dashboard | `/dashboard` | Dashboard Executivo, Dashboard Pessoal (`/dashboard/me`) |
| Reuniões | `/reunioes` | Lista de Reuniões, Calendário (`/calendario`) |
| Processos | `/processos` | — |
| Tarefas | `/tarefas` | — |
| OKRs | `/okrs` | — |
| Governança | `/governanca-ec` | Áreas (`/:areaSlug`), Cards (`/:areaSlug/:cardId`), QLP, Stock Audit |
| Trade | `/trade` | — |
| Analytics | `/analytics` | — |
| Gamificação | `/gamificacao` | — |
| Relatórios | `/relatorios` | — |
| Admin *(CEO)* | `/admin` | Estrutura, Áreas, Usuários, Empresas, Permissões, Configurações, Empregados, Governança EC, Datalake, Bugs |

### 4.2 Páginas Públicas (sem autenticação)

| Rota | Descrição |
|------|-----------|
| `/auth` | Login / Signup (com convite) |
| `/reset-password` | Recuperação de senha |
| `/change-password` | Alteração de senha |
| `/confirm-attendance` | Confirmação de presença em reunião via e-mail |

---

## 5. Design e Interações

### 5.1 Paleta de Cores

| Uso | Cor | Hex |
|-----|-----|-----|
| Primária | Azul Marinho | `#0B3D91` |
| Secundária | Verde-escuro/Teal | `#007A7A` |
| Accent | Âmbar/Ouro | `#FFB400` |
| Background | Branco | `#FFFFFF` |
| Background Alt | Cinza Claro | `#F6F7F9` |
| Texto secundário | Cinza Médio | `#A3A7AF` |
| Texto primário | Preto Suave | `#1F2933` |
| Erro/Atenção | Vermelho | `#E53935` |

> **Nota:** A implementação atual usa shadcn/ui com Tailwind CSS e suporta dark/light mode via `next-themes`.

### 5.2 Tipografia

- **Primária:** Inter (via shadcn/ui defaults)
- **Headings:** Inter SemiBold
- **Body:** Inter Regular

### 5.3 Princípios de Animação

- Duração curta e consistente; respeitar `prefers-reduced-motion`
- `transform` + `opacity` para composições GPU-accelerated
- Feedback imediato via toast (Sonner) + undo para ações destrutivas
- Progressive disclosure: expandir detalhes sob demanda

### 5.4 Padrões de Interação

- Navegação top-bar fixa com contexto constante
- Botão "Criar" contextual por módulo
- Inline editing para ATAs e pautas (click-to-edit)
- Modais para CRUD de entidades
- Bulk actions em listas com checkbox
- Inline validation e loaders para ações longas

---

## 6. Roadmap

### Fase 1 — MVP ✅ (Amplamente implementado)

| Módulo | Status |
|--------|--------|
| Autenticação + RBAC + Permissões granulares | ✅ Completo |
| Reuniões (criação, execução, IA, ATA, PDF) | ✅ Completo |
| Tarefas (CRUD, filtros, vínculo) | ✅ Completo |
| Processos (CRUD, execução, histórico) | ✅ Completo |
| Dashboards (executivo + pessoal) | ✅ Completo |
| Calendário corporativo | ✅ Completo |
| OKRs | ✅ Completo |
| Governança EC + Stock Audit | ✅ Completo |
| Governança EC — Auto-seed de permissões por card | ✅ Completo |
| Gamificação | ✅ Completo |
| Analytics | ✅ Completo |
| Relatórios IA | ✅ Completo |
| Admin (usuários, áreas, empresas, config) | ✅ Completo |
| Trade Marketing — Inventário | ✅ Completo |
| Trade Marketing — Auditorias, PDV, Relatórios | ⏳ Placeholder |
| 2FA | ⏳ Implementado, desabilitado |
| Notificações e-mail/WhatsApp | ✅ Completo |

### Fase 2 — Melhorias (Próxima)

- Integração SSO (Azure AD), calendar sync (Google/Outlook)
- Streaming de transcrição em tempo real (WebSocket)
- Trade Marketing: auditorias completas, PDV, relatórios de campo
- Kanban + bulk actions para tarefas
- Relatórios customizáveis e agendáveis
- Notificações real-time via WebSocket
- Search full-text em transcrições/ATAs
- Versionamento avançado de ATAs

### Fase 3 — Visão de Longo Prazo

- Assistente IA proativo (sugestões de pauta, priorização, previsão de riscos)
- Análises preditivas e benchmarking entre áreas
- Mobile apps nativos (iOS/Android) com offline
- Integrações profundas com ERPs/BI
- Multi-tenant para outros grupos/empresas
- Agentes autônomos para follow-ups

---

## 7. Métricas de Sucesso

| Métrica | Meta |
|---------|------|
| Aderência a rituais (reuniões realizadas vs planejadas) | > 90% |
| Tempo médio de geração de ATA | < 2 min (com IA) |
| Tarefas concluídas no prazo | > 80% |
| Adoção da plataforma (usuários ativos/mês) | 100% dos perfis cadastrados |
| Latência p95 de dashboard | < 500ms |
| Uptime | > 99.5% |

---

*Documento atualizado conforme estado atual de produção e migrações aplicadas até 2026-02-25.*
