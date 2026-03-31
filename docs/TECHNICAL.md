# GA 360 — Documentação Técnica

  > **Versão:** 1.2  
  > **Última atualização:** 2026-03-13  
  > **Produto:** GA 360 (CRESCER+)

  ---

  ## 1. Stack Tecnológico

  | Camada | Tecnologia | Versão |
  |--------|------------|--------|
  | **Frontend** | React + TypeScript | React 18.3, TS 5.x |
  | **Build** | Vite + SWC | Vite 7.3 |
  | **UI Components** | shadcn/ui (Radix UI) | — |
  | **Estilização** | Tailwind CSS | 3.4 |
  | **Routing** | React Router | v6.30 |
  | **State (server)** | TanStack React Query | v5.83 |
  | **State (client)** | React Context (Auth, Company) | — |
  | **Forms** | React Hook Form + Zod | RHF 7.61, Zod 3.25 |
  | **Charts** | Recharts | 2.15 |
  | **Tema** | next-themes (dark/light) | 0.3 |
  | **Toasts** | Sonner | 1.7 |
  | **Backend** | Supabase (PostgreSQL, Auth, Edge Functions, Storage, RLS) | supabase-js 2.85 |
  | **IA - Transcrição** | ElevenLabs Scribe | @elevenlabs/react 0.12 |
  | **IA - Relatórios/ATA** | OpenAI GPT (via Edge Functions) | — |
  | **PDF** | jsPDF | 4.2 |
  | **Deploy** | Vercel | — |
  | **VCS** | GitHub | — |

  ---

  ## 2. Estrutura de Pastas

  ```
  ga360/
  ├── docs/                           # Documentação
  │   ├── PRD.md                      # Product Requirements Document
  │   ├── TECHNICAL.md                # Este documento
  │   └── migration/                  # Scripts de migração Supabase
  │       ├── schema-completo.sql
  │       ├── rls-policies.sql
  │       ├── seed-data.sql
  │       ├── storage-buckets.sql
  │       ├── data-export-queries.sql
  │       ├── reset-pj-data-by-company.sql
  │       ├── sync-pj-contracts-from-company.sql
  │       └── fix-governanca-permissions-by-email.sql
  ├── public/                         # Assets estáticos
  ├── src/
  │   ├── App.tsx                     # Router principal (todas as rotas)
  │   ├── main.tsx                    # Entry point (providers)
  │   ├── index.css                   # Estilos globais + Tailwind
  │   ├── components/
  │   │   ├── ui/                     # shadcn/ui components (Button, Dialog, etc.)
  │   │   ├── layout/                 # AppleNav, MainLayout, Sidebar, TopBar
  │   │   ├── auth/                   # ProtectedRoute, RoleGuard, TwoFactorAuth
  │   │   ├── admin/                  # Componentes do painel admin
  │   │   ├── analytics/              # Filtros e gráficos de analytics
  │   │   ├── dashboard/              # StatsCard, RecentActivity
  │   │   ├── employees/              # Gestão de empregados externos
  │   │   ├── feedback/               # BugReportDialog
  │   │   ├── gamification/           # Leaderboard, Badges, Profile, History
  │   │   ├── governanca-ec/          # Cards, dashboard, formulários EC
  │   │   ├── meetings/               # 14 componentes de reuniões
  │   │   ├── okrs/                   # Objectives, KeyResults, Dashboard
  │   │   ├── processes/              # Dashboard, List, Execution, History
  │   │   ├── reports/                # Assistente IA, Viewer, Examples
  │   │   ├── settings/               # Configurações SMTP, OpenAI, WhatsApp
  │   │   ├── stock-audit/            # Wizard de auditoria de estoque
  │   │   ├── tasks/                  # TaskFormDialog
  │   │   ├── trade/                  # Indústrias, Materiais, Movimentações
  │   │   ├── controle-pj/            # Dashboard, formulários e detalhes de contratos PJ
  │   │   ├── metas/                  # GoalAgentPanel (Portal de Metas)
  │   │   └── cockpit/               # KPICard, AlertCard, filtros e status do Cockpit GA
  │   ├── config/
  │   │   └── supabase.config.ts      # Cliente Supabase (URL + anon key)
  │   ├── contexts/
  │   │   ├── AuthContext.tsx          # Autenticação, perfil, roles, permissões
  │   │   └── CompanyContext.tsx       # Empresa selecionada (multi-company)
  │   ├── hooks/
  │   │   ├── use-mobile.tsx          # Detecção de mobile
  │   │   ├── use-toast.ts            # Hook de toast
  │   │   ├── useAvatarUpload.ts      # Upload de avatar
  │   │   ├── useCardPermissions.ts   # Permissões por card EC
  │   │   └── useStockAudit.ts        # Lógica de auditoria de estoque
  │   ├── integrations/
  │   │   └── supabase/               # Tipos gerados e client
  │   ├── lib/
  │   │   ├── utils.ts                # cn() e utilitários gerais
  │   │   ├── types.ts                # Tipos compartilhados
  │   │   ├── platformConfig.ts       # Config de plataformas de reunião
  │   │   ├── processUtils.ts         # Utilitários de processos
  │   │   ├── pdfGenerator.ts         # Geração de PDF (ATA, relatórios)
  │   │   └── brandGuidelinePdfGenerator.ts
  │   └── pages/                      # 42+ páginas (1 componente por rota)
  ├── supabase/
  │   ├── config.toml                 # Configuração local do Supabase
  │   ├── functions/                  # 37 Edge Functions (Deno)
  │   └── migrations/                 # Migrações SQL
  ├── vercel.json                     # Configuração Vercel (SPA rewrite)
  ├── vite.config.ts                  # Configuração Vite
  ├── tailwind.config.ts              # Configuração Tailwind
  ├── tsconfig.json                   # TypeScript config
  ├── components.json                 # shadcn/ui config
  └── package.json
  ```

  ---

  ## 3. Arquitetura da Aplicação

  ### 3.1 Diagrama de Alto Nível

  ```
  ┌─────────────────────────────────────────────────────┐
  │                    FRONTEND (React)                 │
  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
  │  │  Pages   │  │Components│  │   React Query     │  │
  │  │ (Routes) │──│  (UI)    │──│ (Server State)    │  │
  │  └──────────┘  └──────────┘  └────────┬─────────┘  │
  │                                        │            │
  │  ┌──────────────────┐  ┌──────────────┐│            │
  │  │  AuthContext      │  │CompanyContext││            │
  │  │  (Auth + RBAC)    │  │(Multi-Co)   ││            │
  │  └──────────────────┘  └──────────────┘│            │
  └────────────────────────────────────────┼────────────┘
                                          │
                      ┌────────────────────┼────────────┐
                      │           SUPABASE              │
                      │  ┌──────────┐  ┌──────────────┐ │
                      │  │   Auth   │  │  PostgreSQL   │ │
                      │  │  (JWT)   │  │  (30+ tables) │ │
                      │  └──────────┘  │  + RLS        │ │
                      │                └──────────────┘ │
                      │  ┌──────────┐  ┌──────────────┐ │
                      │  │ Storage  │  │Edge Functions │ │
                      │  │ (S3)     │  │ (37 Deno)    │ │
                      │  └──────────┘  └──────────────┘ │
                      └─────────────────────────────────┘
                                          │
                      ┌────────────────────┼────────────┐
                      │       SERVIÇOS EXTERNOS         │
                      │  ElevenLabs │ OpenAI │ SMTP     │
                      │  WhatsApp   │ Resend             │
                      └─────────────────────────────────┘
  ```

  ### 3.2 Fluxo de Dados

  1. **Usuário** interage com componentes React
  2. **React Query** gerencia cache e chamadas ao Supabase
  3. **Supabase Client** (`@supabase/supabase-js`) faz chamadas REST/Realtime
  4. **RLS Policies** no PostgreSQL filtram dados por empresa/usuário
  5. **Edge Functions** processam lógica complexa (IA, email, transcrição)
  6. **Storage** armazena gravações, fotos, avatares

  ---

  ## 4. Modelo de Dados

  ### 4.0 Atualizações recentes de permissão (Governança EC)

  - Migração aplicada: `supabase/migrations/20260225130000_auto_seed_governanca_card_permissions.sql`
  - Trigger em `user_permissions` para auto-seed de `ec_card_permissions` (`can_view`) ao habilitar `governanca`.
  - Trigger em `ec_cards` para propagar permissão de visualização a usuários elegíveis em novos cards ativos.
  - Backfill incluído na migração para usuários já existentes.

  ### 4.1 Tabelas Principais

  #### Autenticação e Usuários

  | Tabela | Campos principais | Descrição |
  |--------|-------------------|-----------|
  | `profiles` | id, full_name, email, area_id, company_id, avatar_url, is_active | Perfis de usuário (extends Supabase Auth) |
  | `user_roles` | id, user_id, role (`super_admin\|ceo\|diretor\|gerente\|colaborador`) | Roles do usuário |
  | `user_permissions` | id, user_id, module, can_create/read/update/delete | Permissões granulares CRUD por módulo |
  | `user_companies` | id, user_id, company_id, all_companies | Acesso a empresas |
  | `user_invites` | id, email, token, role, area_id, company_id, status | Sistema de convites |
  | `companies` | id, name, cnpj, logo_url, color, is_auditable | Empresas do grupo |
  | `areas` | id, name, parent_id, company_id | Áreas hierárquicas |

  #### Reuniões

  | Tabela | Campos principais | Descrição |
  |--------|-------------------|-----------|
  | `meetings` | id, title, type, area_id, start_at, end_at, ia_mode, status, recurrence_*, room_id | Reuniões agendadas |
  | `meeting_rooms` | id, name, platform, link, company_id | Salas de reunião |
  | `meeting_participants` | id, meeting_id, user_id, status, confirmation_token | Participantes e presença |
  | `meeting_agendas` | id, meeting_id, text, status, order | Pautas da reunião |
  | `meeting_atas` | id, meeting_id, content, action_items, decisions, approved_by, version | ATAs geradas por IA |
  | `meeting_tasks` | id, meeting_id, title, assignee_id, due_date, status, priority | Tarefas de reuniões |
  | `meeting_transcriptions` | id, meeting_id, content, model | Transcrições |
  | `meeting_reminders` | id, meeting_id, type, scheduled_for | Lembretes automáticos |

  #### Processos

  | Tabela | Campos principais |
  |--------|-------------------|
  | `processes` | id, name, description, area_id, frequency, company_id |
  | `process_checklist_items` | id, process_id, text, order |
  | `process_executions` | id, process_id, executor_id, status, started_at, completed_at |
  | `process_execution_items` | id, execution_id, checklist_item_id, completed, comments |
  | `process_responsibles` | id, process_id, user_id |

  #### OKRs

  | Tabela | Campos principais |
  |--------|-------------------|
  | `okr_objectives` | id, title, description, parent_id, level, area_id, start_date, end_date, progress |
  | `okr_key_results` | id, objective_id, title, target_value, current_value, start_value, weight, unit |
  | `okr_key_result_updates` | id, key_result_id, value, notes, updated_by |

  #### Gamificação

  | Tabela | Campos principais |
  |--------|-------------------|
  | `badges` | id, name, description, icon, condition_type, condition_value |
  | `user_badges` | id, user_id, badge_id, earned_at |
  | `user_points` | id, user_id, total_points, level, current_streak |
  | `points_history` | id, user_id, points, action, source_type, source_id |

  #### Trade Marketing

  | Tabela | Campos principais |
  |--------|-------------------|
  | `trade_industries` | id, name, contact_name, contact_email, company_id |
  | `trade_materials` | id, name, category, industry_id, unit |
  | `trade_inventory_movements` | id, material_id, type (in/out), quantity, notes |
  | `trade_inventory_balance` | (View) material_id, balance |

  #### Governança EC

  | Tabela | Campos principais |
  |--------|-------------------|
  | `ec_areas` | id, name, slug, description, icon, color, order |
  | `ec_cards` | id, area_id, title, periodicity, checklist_items, manual_fields, scope, company_id |
  | `ec_card_records` | id, card_id, period, status, filled_by, reviewed_by, checklist_data, manual_data |
  | `ec_card_permissions` | id, card_id, user_id, can_view/fill/review/manage |
  | `ec_card_tasks` | id, card_id, record_id, title, assignee_id, due_date, status |
  | `ec_record_comments` | id, record_id, user_id, content |
  | `ec_record_evidences` | id, record_id, type (file/link), file_path, url, description |

  #### Stock Audit

  | Tabela | Campos principais |
  |--------|-------------------|
  | `stock_audits` | id, company_id, status, planned_date, base_file_data, sample_data, results |
  | `stock_audit_items` | id, audit_id, sku, description, system_qty, counted_qty, recount_qty, root_cause |
  | `stock_audit_item_photos` | id, item_id, file_path |
  | `stock_audit_settings` | id, company_id, sample_percentage, tolerance_percentage |

  #### Datalake

  | Tabela | Campos principais |
  |--------|-------------------|
  | `dl_connections` | id, name, type (sqlserver/rest), config, company_id |
  | `dl_queries` | id, connection_id, name, query_text, parameters |
  | `dl_query_runs` | id, query_id, status, result_data, error |
  | `dl_card_bindings` | id, card_id, query_id, field_mapping, auto_fill |

  #### Sistema

  | Tabela | Descrição |
  |--------|-----------|
  | `audit_logs` | Logs de auditoria (user_id, action, target_type, target_id) |
  | `sync_logs` | Logs de sincronização |
  | `system_settings` | Configurações key-value |
  | `two_factor_codes` | Códigos 2FA temporários |
  | `external_employees` | Empregados importados de sistemas externos |

  ### 4.2 Enums do Sistema

  ```sql
  -- Roles
  app_role: 'super_admin' | 'ceo' | 'diretor' | 'gerente' | 'colaborador'

  -- Módulos (para permissões)
  system_module: 'dashboard_executivo' | 'dashboard_pessoal' | 'meetings' | 
                'calendar' | 'tasks' | 'processes' | 'trade' | 'reports' | 
                'admin' | 'governanca' | 'metas'
  ```

  ### 4.3 Funções do Banco

  | Função | Descrição |
  |--------|-----------|
  | `has_role(user_id, role)` | Verifica se usuário tem uma role específica |
  | `has_permission(user_id, module, action)` | Verifica permissão granular |
  | `has_card_permission(user_id, card_id, permission)` | Permissão por card EC |
  | `has_company_access(user_id, company_id)` | Verifica acesso a empresa |
  | `add_user_points(user_id, points, action, source)` | Adiciona pontos de gamificação |
  | `calculate_level(points)` | Calcula nível do usuário |
  | `link_all_external_employees(company_id)` | Vincula empregados externos |
  | `count_convertible_employees(company_id)` | Conta empregados convertíveis |
  | `cleanup_expired_2fa_codes()` | Limpa códigos 2FA expirados |

  ### 4.4 Scripts operacionais (docs/migration)

  | Script | Finalidade |
  |--------|------------|
  | `sync-pj-contracts-from-company.sql` | Sincroniza colaboradores externos para `pj_contracts` de forma idempotente |
  | `reset-pj-data-by-company.sql` | Remove dados do módulo Controle PJ por empresa (inclui objetos de holerite) |
  | `fix-governanca-permissions-by-email.sql` | Reaplica permissões de governança/cards para usuário específico |
| `cockpit-schema.sql` | Schema das tabelas e views do módulo Cockpit GA |
| `audit-qlp-vinculos.sql` | Consultas de auditoria de vínculos QLP |

  ---

  ## 5. Autenticação e Autorização

  ### 5.1 Fluxo de Autenticação

  ```
  Login (/auth)
      │
      ├── Email + Senha → Supabase Auth
      │       │
      │       ├── [2FA habilitado] → Envio de código → Verificação
      │       │                                           │
      │       └── [2FA desabilitado] ──────────────────────┤
      │                                                    │
      │                              Carrega profile ◄─────┘
      │                              Carrega roles
      │                              Carrega permissions
      │                              Carrega companies
      │                                    │
      │                              AuthContext populated
      │                                    │
      └──────────────────────► ProtectedRoute check
                                      │
                                ┌─────┴──────┐
                                │ Autorizado  │ → Renderiza página
                                │ Não autoriz │ → Redireciona /dashboard
                                │ Não autent  │ → Redireciona /auth
                                └────────────┘
  ```

  ### 5.2 Hierarquia de Roles

  ```
  super_admin (prioridade 0 — acesso total)
      └── ceo (prioridade 1 — configuração geral)
          └── diretor (prioridade 2 — gestão por área)
              └── gerente (prioridade 3 — execução)
                  └── colaborador (prioridade 4 — participação)
  ```

  ### 5.3 Permissões Granulares

  Cada usuário pode ter permissões CRUD por módulo do sistema:

  ```typescript
  interface Permission {
    module: SystemModule;   // ex: 'meetings', 'tasks', 'admin'
    can_create: boolean;
    can_read: boolean;
    can_update: boolean;
    can_delete: boolean;
  }
  ```

  Verificação: `checkPermission(module, action)` no `AuthContext`.

  ### 5.4 Multi-Company

  - Usuários podem ter acesso a múltiplas empresas via `user_companies`
  - Flag `all_companies` dá acesso a todas
  - `CompanyContext` mantém a empresa selecionada
  - RLS filtra dados pela `company_id` da sessão

  ---

  ## 6. Edge Functions (Supabase)

  | Função | Método | Descrição |
  |--------|--------|-----------|
  | `create-user` | POST | Cria usuário via admin (Supabase Auth + profile) |
  | `import-users` | POST | Importação em massa via CSV |
  | `create-users-from-employees` | POST | Converte empregados externos em usuários |
  | `send-invite` | POST | Envia convite por e-mail |
  | `send-2fa-code` | POST | Envia código 2FA (e-mail/WhatsApp) |
  | `send-email-smtp` | POST | Envio genérico de e-mail via SMTP |
  | `send-meeting-notification` | POST | Notificação de reunião |
  | `send-meeting-reminders` | POST | Lembretes automáticos de reunião |
  | `send-attendance-confirmation` | POST | E-mail de confirmação de presença |
  | `send-whatsapp-reminder` | POST | Lembrete via WhatsApp |
  | `confirm-attendance` | POST | Processa confirmação de presença |
  | `elevenlabs-scribe-token` | POST | Gera token para transcrição ElevenLabs |
  | `transcribe-meeting` | POST | Transcrição de reunião (batch) |
  | `generate-ata` | POST | Gera ATA inteligente via LLM |
  | `generate-report` | POST | Gera relatório via OpenAI |
  | `goal-assistant` | POST | Agente IA do Portal de Metas com function calling |
  | `generate-stock-audit-report` | POST | Gera relatório de auditoria de estoque |
  | `test-openai-connection` | POST | Testa conexão com OpenAI |
  | `test-smtp-connection` | POST | Testa conexão SMTP |
  | `sync-companies` | POST | Sincroniza empresas de fonte externa |
  | `sync-employees` | POST | Sincroniza empregados de fonte externa |
  | `sync-verbas` | POST | Sincroniza verbas/folha de pagamento de fonte externa |
  | `verbas-secure-query` | POST | Consulta segura de verbas com isolamento por empresa |
  | `generate-pj-payslip` | POST | Gera holerite PDF para colaboradores PJ |
  | `send-pj-payslip-email` | POST | Envia holerite PJ por e-mail |
  | `verify-2fa-code` | POST | Verifica código 2FA (separado do envio) |
  | `get-companies` | GET | Retorna lista de empresas acessíveis ao usuário |
  | `kpi-summary` | GET | Retorna KPIs consolidados para o Cockpit GA |
  | `geo-heatmap` | GET | Dados georreferenciados para mapa de calor do Cockpit |
  | `city-detail` | GET | Detalhes de uma cidade para o Cockpit GA |
  | `attack-list` | GET | Lista de oportunidades/ataques para o Cockpit comercial |
  | `ai-gateway` | POST | Gateway unificado de IA (roteamento para OpenAI/outros) |
  | `dab-proxy` | GET/POST | Proxy para API DAB (integração de dados externos) |
  | `test-api-connection` | POST | Testa conexão com API externa (evita CORS no browser) |
  | `public-api` | GET/POST | Public API v1 — endpoints REST públicos do GA 360 |
  | `mcp-server` | GET/POST | MCP Server (Model Context Protocol) para integração com Claude Desktop/API |

  ---

  ## 7. Contextos React

  ### 7.1 AuthContext

  ```typescript
  interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    userRoles: UserRole[];
    userPermissions: UserPermission[];
    loading: boolean;
    signIn(email, password): Promise<AuthResponse>;
    signUp(email, password, fullName): Promise<AuthResponse>;
    signOut(): Promise<void>;
    hasRole(role: AppRole): boolean;
    checkPermission(module: SystemModule, action: PermissionAction): boolean;
  }
  ```

  ### 7.2 CompanyContext

  ```typescript
  interface CompanyContextType {
    selectedCompany: Company | null;
    companies: Company[];
    setSelectedCompany(company: Company): void;
    loading: boolean;
  }
  ```

  ---

  ## 8. Padrões de Desenvolvimento

  ### 8.1 Convenções de Código

  | Aspecto | Convenção |
  |---------|-----------|
  | **Componentes** | PascalCase, um componente por arquivo |
  | **Hooks** | `use` prefix (camelCase): `useStockAudit`, `useCardPermissions` |
  | **Páginas** | PascalCase em `src/pages/`, mapeadas 1:1 com rotas |
  | **Tipos** | TypeScript interfaces/types em `lib/types.ts` ou co-located |
  | **Estilos** | Tailwind CSS classes, `cn()` para merge condicional |
  | **Formulários** | React Hook Form + Zod validation |
  | **Data fetching** | React Query (`useQuery`, `useMutation`) com Supabase client |
  | **UI Components** | shadcn/ui (importar de `@/components/ui/`) |
  | **Path alias** | `@/` → `src/` |

  ### 8.2 Padrão de Query (React Query + Supabase)

  ```typescript
  // Exemplo: buscar reuniões
  const { data: meetings, isLoading } = useQuery({
    queryKey: ['meetings', selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('*, meeting_participants(*), meeting_agendas(*)')
        .eq('company_id', selectedCompany?.id)
        .order('start_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });
  ```

  ### 8.3 Padrão de Mutation

  ```typescript
  const mutation = useMutation({
    mutationFn: async (values: MeetingFormValues) => {
      const { data, error } = await supabase
        .from('meetings')
        .insert(values)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success('Reunião criada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar reunião: ' + error.message);
    },
  });
  ```

  ### 8.4 Padrão de Proteção de Rota

  ```tsx
  // Em App.tsx
  <Route path="/admin" element={
    <ProtectedRoute requiredPermission={{ module: 'admin', action: 'view' }}>
      <Admin />
    </ProtectedRoute>
  } />

  // Proteção visual em componentes
  <RoleGuard roles={['super_admin', 'ceo']}>
    <AdminButton />
  </RoleGuard>
  ```

  ---

  ## 9. Deploy e Infraestrutura

  ### 9.1 Vercel

  - **Build command:** `vite build`
  - **Output:** `dist/`
  - **Config:** [vercel.json](../vercel.json) com SPA rewrite
  - **Deploy automático:** push para `main` → deploy em produção

  ### 9.2 Supabase

  - **Projeto:** Hospedado no Supabase Cloud
  - **Edge Functions:** Deploy via `supabase functions deploy`
  - **Migrations:** `supabase/migrations/` — aplicar via CLI
  - **Storage Buckets:** Configurados para avatares, gravações, evidências

  ### 9.3 Variáveis de Ambiente

  | Variável | Onde | Descrição |
  |----------|------|-----------|
  | `VITE_SUPABASE_URL` | Frontend (Vercel) | URL do projeto Supabase |
  | `VITE_SUPABASE_ANON_KEY` | Frontend (Vercel) | Chave anônima do Supabase |
  | `OPENAI_API_KEY` | Edge Functions | Chave da API OpenAI |
  | `ELEVENLABS_API_KEY` | Edge Functions | Chave da API ElevenLabs |
  | `SMTP_*` | Edge Functions / system_settings | Configurações de e-mail |
  | `RESEND_API_KEY` | Edge Functions | Chave do Resend (e-mail) |

  ---

  ## 10. Comandos de Desenvolvimento

  ```bash
  # Instalar dependências
  npm install

  # Servidor de desenvolvimento (porta padrão do Vite)
  npm run dev

  # Build de produção
  npm run build

  # Preview do build
  npm run preview

  # Lint
  npm run lint

  # Deploy Supabase Functions
  supabase functions deploy <function-name>

  # Aplicar migrations
  supabase db push
  ```

  ---

  ## 11. Módulos e Status de Implementação

  | Módulo | Componentes | Status | Notas |
  |--------|-------------|--------|-------|
  | Auth & RBAC | 3 | ✅ Completo | 2FA implementado mas desabilitado |
  | Reuniões | 14 | ✅ Completo | Ciclo completo com IA |
  | Processos | 7 | ✅ Completo | CRUD + execução + histórico |
  | Tarefas | 1 | ✅ Funcional | Lógica na página, 1 componente form |
  | Dashboard | 2 | ✅ Funcional | Executivo + Pessoal |
  | Calendário | — | ✅ Completo | Lógica na página |
  | OKRs | 6 | ✅ Completo | Objetivos + Key Results |
  | Governança EC | 22 | ✅ Completo | Sistema mais robusto do app |
  | Stock Audit | 8 | ✅ Completo | Wizard completo |
  | Gamificação | 4 | ✅ Completo | Leaderboard + Badges |
  | Analytics | 5 | ✅ Completo | Filtros + KPIs + Gráficos |
  | Relatórios | 3 | ✅ Completo | Assistente IA |
  | Trade - Inventário | 7 | ✅ Completo | Indústrias + Materiais + Movimentos |
  | Trade - Auditorias | — | ⏳ Placeholder | Tab com "em desenvolvimento" |
  | Trade - PDV | — | ⏳ Placeholder | Tab com "em desenvolvimento" |
  | Trade - Relatórios | — | ⏳ Placeholder | Tab com "em desenvolvimento" |
  | Admin | 7 + 6 + 4 | ✅ Completo | Usuários, Áreas, Config, Employees, API Keys |
  | Notificações | — | ✅ Completo | E-mail + WhatsApp via Edge Functions |
  | Metas | 1 | ✅ Completo | F1–F3 entregues; F4 (gamificação + dashboard widget) pendente |
  | Controle PJ | 5 | ✅ Completo | Contratos, holerites, férias, dashboard |
  | Verbas | — | ⚠️ Em ajuste | Staging-first sync implementado; re-sync completo necessário para popular staging |
  | Cockpit GA | 5 | ✅ Completo | Home, Comercial, Logística, Mapa, Configurações |
  | Public API / MCP | — | ✅ Completo | REST API v1 + MCP Server para integração externa |

  ---

  ## 12. Módulo Verbas — Arquitetura e Pendências

  ### 12.1 Arquitetura de dados (staging-first)

  ```
  DAB (Datalake)
      │  fetch ALL records (sem filtro de empresa)
      ▼
  payroll_verba_staging          ← tabela sem company_id
    (cpf, tipo_verba, ano, jan..dez)
    UNIQUE (cpf, tipo_verba, ano)
      │
      │  apply_payroll_staging(p_ano)  ← função PostgreSQL
      │  JOIN external_employees ON normalize(cpf) = normalize(cpf)
      │  company_id = COALESCE(accounting_company_id, company_id)
      ▼
  payroll_verba_pivot            ← tabela com company_id
    UNIQUE (company_id, cpf, tipo_verba, ano)
  ```

  **Regra principal:** a empresa de um colaborador nunca vem do DAB — sempre vem de `external_employees.company_id` (ou `accounting_company_id`). O DAB só fornece `(cpf, tipo_verba, valores mensais)`.

  ### 12.2 Tabelas envolvidas

  | Tabela | Descrição | Chave única |
  |--------|-----------|-------------|
  | `payroll_verba_staging` | Dados brutos do DAB, sem company | `(cpf, tipo_verba, ano)` |
  | `payroll_verba_pivot` | Dados finais com company resolvida | `(company_id, cpf, tipo_verba, ano)` |
  | `external_employees` | Cadastro de funcionários com `company_id` | `(company_id, cpf)` |

  ### 12.3 Função crítica: `apply_payroll_staging(p_ano)`

  ```sql
  SELECT * FROM apply_payroll_staging(2026);
  -- Retorna: { inserted_or_updated: N, cpfs_sem_empresa: M }
  ```

  - `p_ano NULL` → processa todo o staging (todos os anos)
  - CPF normalizado nos dois lados: `REGEXP_REPLACE(cpf, '\D', '', 'g')`
  - Prioridade de empresa: `accounting_company_id > company_id`
  - Desempate: `is_active DESC, is_disabled ASC`

  ### 12.4 Estado atual e pendências

  **O que está implementado:**
  - `sync-verbas` agora grava em `payroll_verba_staging` (sem company) e chama `apply_payroll_staging()` automaticamente
  - Botão "Recalcular associações" na UI — re-executa o JOIN sem re-buscar o DAB
  - Tabela plana estilo Excel na página Verbas (view padrão)
  - Filtros reativos (sem botão "Buscar")

  **O que falta para ver todas as empresas:**
  1. Executar uma **Carga inicial completa** para popular `payroll_verba_staging` com todos os CPFs do DAB
  2. O `apply_payroll_staging` então distribui os dados pelas empresas corretas via JOIN com `external_employees`
  3. CPFs que aparecem como "sem empresa" após apply = CPFs que **de fato não estão** em `external_employees`

  **Nota:** o staging atual está vazio (a nova arquitetura foi implementada em 2026-03-16). Os dados existentes em `payroll_verba_pivot` foram populados pelo mecanismo antigo (que ignorava CPFs sem empresa). Para corrigir isso, executar "Carga inicial completa" ou "Recalcular associações" após executar uma nova sincronização.

  ---

  ## 13. Guia de Contribuição

  ### 13.1 Adicionando um Novo Módulo

  1. Criar página em `src/pages/NomeModulo.tsx`
  2. Adicionar rota em `src/App.tsx`
  3. Criar componentes em `src/components/nome-modulo/`
  4. Se necessário, adicionar tabela no Supabase com migration
  5. Atualizar tipos em `src/integrations/supabase/types.ts`
  6. Adicionar item de navegação em `src/components/layout/AppleNav.tsx`
  7. Configurar permissões se necessário (RoleGuard/ProtectedRoute)

  ### 13.2 Adicionando um Componente shadcn/ui

  ```bash
  npx shadcn-ui@latest add <component-name>
  ```

  Os componentes são instalados em `src/components/ui/`.

  ### 12.3 Criando uma Edge Function

  ```bash
  supabase functions new <nome-da-funcao>
  # Editar supabase/functions/<nome>/index.ts
  supabase functions deploy <nome-da-funcao>
  ```

  ---

  ## 13. Plano Técnico de Implantação — Portal de Metas + Agente IA

  ### 13.0 Status atual (checkpoint)

  - **Data de referência:** 2026-02-26
  - **Fases concluídas:** F1 — Base de dados + Segurança; F2 — CRUD operacional (sem IA); F3 — Agente IA
  - **Fase em execução:** F4 — Integrações e fechamento
  - **Pendências imediatas:** integração de gamificação, widget de metas no dashboard executivo e consultas de auditoria operacional.

  ### 13.1 Estratégia de entrega (fases)

  Para reduzir risco de regressão no app em produção, a implantação do módulo `metas` deve ocorrer em quatro fases incrementais.

  | Fase | Objetivo | Escopo | Critério de conclusão |
  |------|----------|--------|-----------------------|
  | **F1 — Base de dados + Segurança** | Disponibilizar fundação do módulo com RLS | Migration (`system_module='metas'`, enums, tabelas `goals`, `goal_activities`, `goal_updates`, `goal_comments`, `goal_agent_messages`), índices, triggers, policies | Leitura/escrita funcionando via SQL com isolamento por empresa e sem violar RLS |
  | **F2 — CRUD operacional (sem IA)** | Entregar módulo utilizável pelo time | Rota `/metas`, item no `AppleNav`, lista, filtros, criação/edição de meta, atividades e atualização de progresso/histórico | Usuário com permissão `metas` consegue criar e acompanhar metas sem usar chat |
  | **F3 — Agente IA** | Acelerar operação por linguagem natural | Edge Function `goal-assistant`, painel lateral fixo, histórico em `goal_agent_messages`, function calling com tools de metas | Chat cria/edita/consulta metas com auditoria de chamadas e invalidando cache corretamente |
  | **F4 — Integrações e fechamento** | Consolidar valor do módulo no ecossistema | Integração com gamificação ao concluir meta, widget no dashboard executivo, ajustes de performance/observabilidade | Indicadores visíveis no dashboard e fluxo completo validado em produção |

  ### 13.2 Backlog técnico por fase

  #### F1 — Base de dados + Segurança
  - Criar migration versionada para o Portal de Metas.
  - Adicionar `metas` ao enum `system_module`.
  - Criar políticas RLS por empresa para todas as novas tabelas.
  - Garantir imutabilidade prática de `goal_updates` (SELECT/INSERT apenas).
  - Regenerar tipos Supabase em `src/integrations/supabase/types.ts`.

  #### F2 — CRUD operacional (sem IA)
  - Criar `src/pages/Metas.tsx` com layout principal.
  - Implementar componentes de lista, card, filtros, detalhe e formulários.
  - Implementar hooks React Query (`useQuery`/`useMutation`) com invalidação por `queryKey`.
  - Respeitar `selectedCompanyId` do `CompanyContext` em todas as queries.
  - Proteger rota com `ProtectedRoute requiredPermission={{ module: 'metas', action: 'view' }}`.

  #### F3 — Agente IA
  - Criar `supabase/functions/goal-assistant/index.ts` com padrão de Edge Functions existente.
  - Implementar tools: `create_goal`, `create_goal_activity`, `update_goal`, `update_goal_progress`, `deactivate_goal`, `complete_goal_activity`, `query_goals`.
  - Persistir mensagens e tool calls em `goal_agent_messages`.
  - Implementar `GoalAgentPanel` fixo na página `/metas`.
  - Garantir guardrails: nunca operar fora da `company_id` do usuário.

  #### F4 — Integrações e fechamento
  - Integrar pontos de gamificação para conclusão de metas.
  - Adicionar card/widget de metas no dashboard executivo.
  - Criar consultas de auditoria para metas sem responsável e metas vencidas ativas.
  - Refinar UX (loading states, empty states, mensagens de erro).
  - Validar rollout em produção com usuários reais de áreas distintas.

  ### 13.3 Estimativa de esforço (referência)

  | Fase | Esforço estimado |
  |------|------------------|
  | F1 | 1–2 dias |
  | F2 | 3–5 dias |
  | F3 | 3–4 dias |
  | F4 | 1–2 dias |

  Total estimado: **8–13 dias úteis** (1 dev full-time, sem bloqueios externos).

  ### 13.4 Critérios de aceite por fase

  #### Aceite F1
  - Migration aplicada sem erro em ambiente de homologação.
  - Políticas RLS validadas com usuário com e sem acesso à empresa.

  #### Aceite F2
  - CRUD completo de metas e atividades operando via UI.
  - Histórico de progresso registrando em `goal_updates`.
  - Build e lint sem regressões.

  #### Aceite F3
  - Agente responde e executa tools com segurança.
  - Todas as mutações do agente refletem na UI após invalidação de cache.
  - Logs de erro da edge function legíveis para suporte.

  #### Aceite F4
  - Pontuação de gamificação em conclusão de meta funcionando.
  - Dashboard exibe indicadores de metas por pilar.
  - Checklist de regressão aprovado para módulos existentes.

  ### 13.5 Riscos técnicos e mitigação

  - **Risco:** divergência de nomenclatura de permissões (`view/create/edit/delete` vs `read/update`).
    - **Mitigação:** padronizar no módulo novo com a convenção já vigente do app.
  - **Risco:** exposição indevida por RLS mal parentizada em policies com `OR`.
    - **Mitigação:** sempre usar parênteses explícitos em condições compostas.
  - **Risco:** custo/latência altos no agente IA.
    - **Mitigação:** limitar histórico enviado, reduzir contexto e monitorar uso por empresa.
  - **Risco:** escopo grande para um único release.
    - **Mitigação:** liberar por fases com feature completeness progressiva.

  ### 13.6 Ordem recomendada de deploy

  1. Deploy do backend (migration F1).
  2. Deploy do frontend F2 (sem painel IA).
  3. Deploy da Edge Function `goal-assistant` e frontend F3.
  4. Deploy final com integrações F4.

  ---

  *Documento atualizado conforme código e migrações em produção até 2026-03-13.*
