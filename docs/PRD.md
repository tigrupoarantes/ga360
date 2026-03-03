# GA 360 — Product Requirements Document (PRD)

> **Versão:** 1.2  
> **Última atualização:** 2026-03-03  
> **Produto:** GA 360 (CRESCER+)  
> **Organização:** Grupo Arantes  
> **Status:** Em produção

---

## 1. Visão Geral do Produto

### 1.1 Descrição (como está no app hoje)

GA 360 é um portal corporativo (web) para **gestão de reuniões**, **tarefas derivadas de reuniões**, **processos recorrentes**, **OKRs**, **Metas** e **Governança EC** (cards do Escritório Central), com recursos de **IA opcionais** (transcrição/ATA/relatórios/copiloto de metas) acionados via Supabase Edge Functions.

O app é **multi-empresa** (seletor no topo) e opera com **permissões por módulo** (RBAC) e, dentro de Governança EC, com **permissões por card** (ex.: QLP, Controle PJ, VERBAS, Auditoria de Estoque).

### 1.2 Público-alvo

| Perfil | Responsabilidades |
|--------|-------------------|
| **CEO / Super Admin** | Configuração geral, visão consolidada, aprovação de ATAs, gestão de permissões |
| **Diretores** | Gestão de tópicos, reuniões e processos por área |
| **Gerentes** | Execução de tarefas, condução de rituais, checagem de processos |
| **Colaboradores Especiais** | Execução de tarefas atribuídas, comentários em pautas |
| **Equipe de campo** | Trade Marketing: auditorias, evidências de PDV |

### 1.3 Proposta de Valor

Unificar rituais (reuniões/processos) e execução (tarefas/metas) em um único lugar, com rastreabilidade e automações (convites/lembranças) e **IA sob configuração** para reduzir trabalho manual em transcrição/ATA/relatórios e acelerar análise gerencial.

---

## 2. Requisitos Funcionais (MoSCoW)

### 2.1 Must Have (Essenciais)

#### Autenticação e Autorização
- Login por e-mail + senha
- Recuperação de senha (`/reset-password`) e alteração de senha (`/change-password`)
- RBAC por perfil: `super_admin`, `ceo`, `diretor`, `gerente`, `colaborador`
- Permissões por módulo/ação (ex.: `metas:view/create/edit/delete`, `admin:view`), aplicadas via `ProtectedRoute`/`RoleGuard`
- Multi-empresa com seletor global e isolamento por empresa via políticas (RLS no Supabase)
- Convites por e-mail com token (Admin → Configurações → Convites)
- 2FA (código via e-mail ou WhatsApp) existe no backend, porém **está bypassado no frontend por flag** (`SKIP_2FA_TEMPORARILY=true`)

#### Reuniões
- Listagem e criação de reuniões, com sala (meeting room) e área
- Pautas (agenda) vinculadas à reunião, com marcação de concluída
- Participantes: adicionar/remover; marcar presença; fluxo de **confirmação de presença** via link com token (`/confirm-attendance`)
- Execução de reunião (`/reunioes/:id/executar`) com status e controle de finalização
- Modos de IA por reunião (`ai_mode`): quando **Obrigatório**, não permite finalizar sem transcrição salva
- Transcrição:
	- **Tempo real** via ElevenLabs Scribe (token via função `elevenlabs-scribe-token`)
	- **Upload de gravação** e transcrição via OpenAI Whisper (função `transcribe-meeting`)
- ATA: geração via OpenAI (função `generate-ata`) a partir da transcrição salva; cria ATA em `meeting_atas` e tarefas em `meeting_tasks`
- Visualização de ATA (viewer) dentro do módulo de Reuniões

#### Tarefas
- CRUD e acompanhamento de tarefas **do tipo `meeting_tasks`** (geradas da ATA e/ou criadas manualmente)
- Lista com filtros por status, prioridade e busca por texto
- Marcação rápida de concluída/reaberta
- Vínculo com reunião (exibe dados da reunião relacionada)

#### Processos
- Gestão de processos recorrentes por empresa (Dashboard / Lista / Histórico)
- Execução e histórico (conforme componentes `ProcessDashboard`, `ProcessList`, `ProcessExecutionHistory`)

#### Dashboards
- Dashboard Executivo (`/dashboard`) com KPIs básicos (reuniões do mês, tarefas concluídas/atrasadas) e próximas reuniões
- Dashboard Pessoal (`/dashboard/me`)
- Área de gráficos de KPIs existe como **placeholder** ("em desenvolvimento")

#### Calendário
- Calendário com visão mensal e eventos (módulo `Calendar`)

#### Trade Marketing
- Inventário: Dashboard e gestão operacional (componente `InventoryDashboard`)
- Auditorias/PDV/Relatórios: **abas existentes, porém conteúdo está em desenvolvimento (placeholder)**

#### OKRs
- Dashboard e lista de objetivos por empresa

#### Governança EC (Escritório Central)
- Home (`/governanca-ec`) com dashboard de cards/áreas
- Áreas (`/governanca-ec/:areaSlug`) e detalhe de card (`/governanca-ec/:areaSlug/:cardId`)
- Permissões **por card** (hook `useCardPermissions`) aplicadas em páginas especiais
- Integração com Datalake/SQL Server via Edge Functions (`dab-proxy`, `execute-datalake-query`) para consultas e sincronizações
- Páginas especiais sob Pessoas & Cultura (todas com checagem de permissão por card):
	- QLP (`/governanca-ec/pessoas-cultura/qlp`)
	- Controle PJ (`/governanca-ec/pessoas-cultura/controle-pj` + detalhe por contrato)
	- VERBAS (`/governanca-ec/pessoas-cultura/verbas`) com consulta segura e opção de mascaramento
- Auditoria: Auditoria de Estoque (`/governanca-ec/auditoria/estoque`) com wizard + histórico

#### Pessoas & Cultura — Controle PJ
- Gestão de contratos PJ (CRUD), por empresa
- Fechamentos por competência (status, itens adicionais, logs)
- Banco de folgas (eventos) e saldo
- Geração de holerite (PDF) e envio por e-mail via Edge Functions (`generate-pj-payslip`, `send-pj-payslip-email`)
- Sincronizações operacionais via funções (`sync-employees`, `create-users-from-employees`) e scripts de migração (ver pasta `docs/migration/`)

#### Auditoria de Estoque (Stock Audit)
- Wizard de auditoria e histórico
- Relatório gerado via Edge Function (`generate-stock-audit-report`) e visualização/envio no fluxo

#### Gamificação
- Página e componentes do módulo (leaderboard/perfil/pontos), conforme implementação atual

#### Analytics
- Filtros por período, empresa e área
- KPIs e visões detalhadas (Reuniões, Tarefas, Participação)

#### Relatórios
- Assistente de IA para geração de relatórios (Edge Function `generate-report`), usando OpenAI configurado em `system_settings`
- Visualizador de relatório e exportação em PDF (jsPDF)

#### Administração
- Hub de administração (`/admin`) com:
	- Estrutura Organizacional (`/admin/estrutura`)
	- Áreas (`/admin/areas`)
	- Usuários (`/admin/users`) + importação CSV (`import-users`)
	- Empresas (`/admin/empresas`)
	- Permissões (`/admin/permissions`)
	- Funcionários Externos (`/admin/employees`) e conversão em usuários
	- Governança EC (admin) (`/admin/governanca-ec`) e Integração Datalake (`/admin/datalake`)
	- Bugs (`/admin/bugs`)
	- Configurações (`/admin/settings`): Convites, SMTP, WhatsApp, Auditoria, IA (OpenAI/Gemini) e Geral (alguns toggles desabilitados)

#### Notificações
- Confirmação de presença: envio de e-mail via Resend (`send-attendance-confirmation`)
- Lembretes de reunião: rotina via Edge Function (`send-meeting-reminders`) com envio via Resend; WhatsApp opcional via `send-whatsapp-reminder` quando habilitado
- Convites de usuários por e-mail via SMTP (função `send-invite`) usando configuração em `system_settings`

#### Segurança e Conformidade
- Autenticação via Supabase Auth
- Políticas de isolamento por empresa via RLS no Supabase (quando aplicável)
- Uso de Service Role nas Edge Functions para operações administrativas/integrações

#### Performance
- Cache de consultas via React Query

#### Responsividade
- Layout responsivo com menu mobile no header

---

### 2.2 Should Have (Importantes, mas não bloqueadores)

- Integração com calendários (Google/Outlook) para sincronização
- Search global funcional (o campo de busca existe no header, mas ainda não executa buscas)
- WebSocket/real-time updates para status de reuniões e tarefas
- Controle de versão de ATAs e histórico de edições
- Export avançado (PowerPoint, pack de relatórios customizados)
- MFA/SSO (SAML/Azure AD)

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

**Layout atual:** header fixo (AppleNav) + barra fixa de seletor de empresa.

| Item | Rota | Observações |
|------|------|----------|
| Dashboard | `/dashboard` | Inclui `/dashboard/me` |
| Reuniões | `/reunioes` | Inclui `/calendario` e execução `/reunioes/:id/executar` |
| Processos | `/processos` | Por empresa |
| Tarefas | `/tarefas` | `meeting_tasks` |
| OKRs | `/okrs` | Por empresa |
| Metas | `/metas` | Requer permissão `metas:view` |
| Governança EC | `/governanca-ec` | Áreas/cards e páginas especiais (QLP/Controle PJ/VERBAS/Stock Audit) |
| Trade | `/trade` | Inventário ok; outras abas placeholder |
| Analytics | `/analytics` | KPIs e análises |
| Gamificação | `/gamificacao` | — |
| Relatórios | `/relatorios` | IA + export PDF |
| Admin | `/admin` | Requer `admin:view` e role (super_admin/ceo/diretor) |

### 4.2 Páginas Públicas (sem autenticação)

| Rota | Descrição |
|------|-----------|
| `/auth` | Login / Signup (com convite) |
| `/reset-password` | Recuperação de senha |
| `/change-password` | Alteração de senha |
| `/confirm-attendance` | Confirmação de presença em reunião via e-mail |

### 4.3 Páginas Autenticadas (outras)

| Rota | Descrição |
|------|-----------|
| `/profile` | Perfil do usuário |
| `*` | NotFound |

---

## 5. Design e Interações

### 5.1 Design System

- UI construída com **shadcn/ui + Tailwind CSS**, com temas light/dark via `next-themes`
- Cores e tokens vêm de **CSS variables/Tailwind theme** (sem tabela fixa de hex no PRD, pois o tema é configurável)
- Header fixo com estilo “glass” e menu mobile (hamburger)

### 5.2 Tipografia

- Tipografia padrão do stack (shadcn/ui)

### 5.3 Princípios de Animação

- Duração curta e consistente; respeitar `prefers-reduced-motion`
- `transform` + `opacity` para composições GPU-accelerated
- Feedback imediato via toast (Sonner)
- Progressive disclosure: expandir detalhes sob demanda (quando aplicável)

### 5.4 Padrões de Interação

- Navegação top-bar fixa com contexto constante
- Ações principais contextuais por módulo (ex.: criar/editar/executar)
- Edição e revisão de conteúdo (pautas/transcrições/ATA) conforme disponibilidade na tela
- Diálogos/modais e formulários para CRUD de entidades
- Validações e loaders durante operações assíncronas

---

## 6. Roadmap (baseado no estado atual)

### Estado Atual — Em produção

| Módulo | Status no app |
|--------|--------------|
| Auth + RBAC + permissões por módulo | ✅ Implementado |
| 2FA (email/WhatsApp) | ⚠️ Backend ok; **bypass no frontend** |
| Reuniões (agenda, participantes, execução) | ✅ Implementado |
| Transcrição (ElevenLabs real-time / OpenAI Whisper via upload) | ✅ Implementado (depende de configuração/keys) |
| ATA via OpenAI + geração de tarefas | ✅ Implementado (depende de configuração/keys) |
| Tarefas (meeting_tasks) | ✅ Implementado |
| Processos (dashboard/lista/histórico) | ✅ Implementado |
| Dashboards | ✅ KPIs básicos; 📌 gráficos ainda placeholder |
| Calendário | ✅ Implementado |
| OKRs | ✅ Implementado |
| Metas (goals/atividades/updates) + copiloto IA | ✅ Implementado (IA depende de configuração) |
| Governança EC + permissões por card | ✅ Implementado |
| QLP / Controle PJ / VERBAS / Stock Audit | ✅ Implementado (com checagem por card) |
| Relatórios IA + export PDF | ✅ Implementado (IA depende de configuração) |
| Admin (usuários/empresas/permissões/config/empregados externos/datalake/bugs) | ✅ Implementado |
| Trade — Inventário | ✅ Implementado |
| Trade — Auditorias/PDV/Relatórios | ⏳ Em desenvolvimento (placeholder) |
| Notificações e-mail (Resend/SMTP) | ✅ Implementado (depende de secrets) |
| WhatsApp (Twilio/Evolution) | ✅ Funções existentes; UI de configuração existe; uso depende de habilitação |

### Próximas Melhorias (alinhadas ao backlog real)

- Search global funcional (tarefas/reuniões/transcrições/ATAs)
- Trade Marketing: concluir Auditorias/PDV/Relatórios
- Evoluir gráficos/KPIs do Dashboard (remover placeholder)
- Melhorar fluxo de 2FA (reativar no frontend, UX e persistência de sessão)
- SSO/MFA corporativo (Azure AD) e calendar sync
- Versionamento de ATA e histórico de edições

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
| Tempo médio de geração de ATA | Meta operacional (quando IA habilitada) |
| Tarefas concluídas no prazo | > 80% |
| Adoção da plataforma (usuários ativos/mês) | 100% dos perfis cadastrados |
| Latência p95 de dashboard | < 500ms |
| Uptime | > 99.5% |

---

*Documento atualizado conforme o estado do frontend (`src/`) e Edge Functions (`supabase/functions/`) em 2026-03-03.*
