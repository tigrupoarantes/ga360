# GA 360 — Instruções do Agente Copilot
> PRD v1.2 — atualizado 2026-03-03

## Contexto do Projeto

GA 360 (CRESCER+) é um portal corporativo web do Grupo Arantes para gestão de **reuniões**, **tarefas**, **processos**, **OKRs**, **Metas** e **Governança EC** (cards do Escritório Central), com **IA opcional** acionada via Supabase Edge Functions.

App em **produção**. Multi-empresa com seletor global no topo.

---

## Stack

- **Frontend:** React + Vite, TypeScript, Tailwind CSS, shadcn/ui, TanStack React Query, Sonner (toasts), next-themes (dark/light)
- **Backend/DB:** Supabase (PostgreSQL + RLS + Storage + Auth)
- **Edge Functions:** Supabase Edge Functions (Deno)
- **IA:** OpenAI (ATA, relatórios, copiloto de metas), Gemini (alternativa configurável), ElevenLabs Scribe (transcrição real-time), OpenAI Whisper (transcrição via upload)
- **E-mail:** Resend + SMTP configurável em `system_settings`
- **WhatsApp:** Twilio / Evolution (opcional, via configuração)

### Edge Functions relevantes

| Função | Responsabilidade |
|--------|-----------------|
| `elevenlabs-scribe-token` | Token para transcrição real-time |
| `transcribe-meeting` | Transcrição via Whisper (upload) |
| `generate-ata` | Gera ATA + `meeting_tasks` via OpenAI |
| `generate-report` | Relatórios IA |
| `generate-pj-payslip` | Holerite PDF (Controle PJ) |
| `send-pj-payslip-email` | Envio de holerite por e-mail |
| `send-attendance-confirmation` | Confirmação de presença (Resend) |
| `send-meeting-reminders` | Lembretes de reunião |
| `send-whatsapp-reminder` | Lembrete WhatsApp (quando habilitado) |
| `send-invite` | Convite de usuário por e-mail |
| `generate-stock-audit-report` | Relatório de auditoria de estoque |
| `dab-proxy` / `execute-datalake-query` | Integração SQL Server / Datalake |
| `sync-employees` / `create-users-from-employees` | Sincronização de funcionários externos |
| `import-users` | Importação CSV de usuários |

---

## Auth e RBAC

- **Perfis:** `super_admin`, `ceo`, `diretor`, `gerente`, `colaborador`
- **Permissões por módulo:** ex. `metas:view`, `metas:create`, `admin:view` — aplicadas via `ProtectedRoute` / `RoleGuard`
- **Permissões por card** (Governança EC): hook `useCardPermissions`
- **Multi-empresa:** isolamento via RLS no Supabase; seletor global de empresa no header
- **2FA:** backend implementado, **bypassado no frontend** (`SKIP_2FA_TEMPORARILY=true`) — não remover esse bypass sem task explícita
- **Edge Functions administrativas** usam Service Role (nunca expor no frontend)

---

## Como Me Ajudar

1. **Implemente direto.** Quando descrever uma feature, vá fundo — não pergunte o óbvio.
2. **Preserve o que existe.** Leia os arquivos relacionados antes de editar. Não quebre imports, tipos ou lógica existente.
3. **Siga os padrões do projeto.** Use componentes shadcn/ui já existentes, estilo Tailwind dos arquivos vizinhos e React Query para dados servidor.
4. **Supabase first.** Para dados persistidos, use o cliente Supabase existente. Sempre respeite o RLS — filtre por `company_id` quando relevante.
5. **React Query consistente.** `useQuery` / `useMutation` com `invalidateQueries` após mutações. Não duplique fetching com `useEffect`.
6. **RBAC consciente.** Verifique perfil e permissão do usuário antes de renderizar ações sensíveis. Use `ProtectedRoute` / `RoleGuard` existentes.
7. **TypeScript estrito.** Tipos explícitos, sem `any`. Prefira inferência quando óbvio. Sem `@ts-ignore` sem justificativa.
8. **Solução mais simples** que resolve. Sem over-engineering.

---

## O que Evitar

- Não reescreva arquivos inteiros para mudanças pontuais
- Não adicione dependências npm sem mencionar explicitamente
- Não crie abstrações novas sem necessidade clara
- Não ignore o RLS — dados são sempre isolados por `company_id`
- Não remova o bypass de 2FA (`SKIP_2FA_TEMPORARILY`) sem task explícita
- Não chame Edge Functions diretamente do frontend com Service Role key
- Não use `useEffect` para buscar dados — use React Query

---

## Status dos Módulos (referência rápida)

| Módulo | Status |
|--------|--------|
| Auth + RBAC + permissões por módulo | ✅ Ok |
| 2FA | ⚠️ Backend ok; bypass no frontend |
| Reuniões (agenda, participantes, execução, ATA) | ✅ Ok |
| Transcrição (ElevenLabs real-time + Whisper upload) | ✅ Ok (depende de keys) |
| Tarefas (`meeting_tasks`) | ✅ Ok |
| Processos | ✅ Ok |
| Dashboards | ✅ KPIs básicos; 📌 gráficos = placeholder |
| Calendário | ✅ Ok |
| OKRs | ✅ Ok |
| Metas + copiloto IA | ✅ Ok (IA depende de config) |
| Governança EC + permissões por card | ✅ Ok |
| QLP / Controle PJ / VERBAS / Stock Audit | ✅ Ok (checagem por card) |
| Relatórios IA + export PDF (jsPDF) | ✅ Ok (IA depende de config) |
| Admin completo | ✅ Ok |
| Trade — Inventário | ✅ Ok |
| Trade — Auditorias / PDV / Relatórios | ⏳ Placeholder — em desenvolvimento |
| Notificações e-mail | ✅ Ok (depende de secrets) |
| WhatsApp | ✅ Funções ok; depende de habilitação |

---

## Rotas de Referência

| Módulo | Rota |
|--------|------|
| Dashboard | `/dashboard`, `/dashboard/me` |
| Reuniões | `/reunioes`, `/reunioes/:id/executar` |
| Calendário | `/calendario` |
| Processos | `/processos` |
| Tarefas | `/tarefas` |
| OKRs | `/okrs` |
| Metas | `/metas` |
| Governança EC | `/governanca-ec`, `/:areaSlug`, `/:areaSlug/:cardId` |
| QLP | `/governanca-ec/pessoas-cultura/qlp` |
| Controle PJ | `/governanca-ec/pessoas-cultura/controle-pj` |
| VERBAS | `/governanca-ec/pessoas-cultura/verbas` |
| Stock Audit | `/governanca-ec/auditoria/estoque` |
| Trade | `/trade` |
| Analytics | `/analytics` |
| Gamificação | `/gamificacao` |
| Relatórios | `/relatorios` |
| Admin | `/admin` (requer `admin:view`) |
| Perfil | `/profile` |
| Auth | `/auth`, `/reset-password`, `/change-password`, `/confirm-attendance` |
