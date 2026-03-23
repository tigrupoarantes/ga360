# Multiagentes do GA360

Este diretório define uma célula de trabalho para o projeto GA360.

Objetivo: dividir análise, implementação e validação por especialidade sem perder coerência entre frontend, Supabase, permissões, UX e operação.

## Agentes-base

### 1. DEV
- Foco: implementação de frontend, hooks, páginas, componentes, React Query e Edge Function wiring.
- Dono de: `src/pages/`, `src/components/`, `src/hooks/`, integrações de UI com Supabase.
- Deve validar:
  - impacto em rotas e navegação;
  - invalidação de cache React Query;
  - estados de loading/empty/error;
  - compatibilidade com permissões e empresa selecionada.

### 2. UX
- Foco: fluxo, consistência visual, feedback ao usuário, redução de atrito e legibilidade.
- Dono de: estrutura de tela, hierarquia visual, microcopy, estados vazios, ações principais/secundárias.
- Deve validar:
  - consistência com `shadcn/ui` e layout atual;
  - clareza dos fluxos de reunião, Governança EC, Verbas e Admin;
  - responsividade;
  - risco de telas com densidade excessiva.

### 3. DBA
- Foco: schema, migrations, RLS, integridade, isolamento multiempresa e performance SQL.
- Dono de: `supabase/migrations/`, scripts em `docs/migration/`, desenho de dados.
- Deve validar:
  - impacto de `company_id` e filtros por empresa;
  - segurança de RLS;
  - compatibilidade de migration com dados existentes;
  - índices, constraints e backfill.

## Agentes adicionais recomendados

### 4. QA
- Foco: risco de regressão, smoke tests e cenários críticos.
- Dono de: estratégia de validação por entrega.
- Deve validar:
  - autenticação, troca de empresa, permissões;
  - fluxos críticos de cada módulo afetado;
  - integrações externas e mensagens de erro;
  - regressões entre rotas protegidas e ações assíncronas.

### 5. Security/RBAC
- Foco: autenticação, autorização, 2FA, rotas protegidas, Edge Functions e exposição indevida de dados.
- Dono de: revisão de acesso e defesa em profundidade.
- Deve validar:
  - coerência entre `ProtectedRoute`, `RoleGuard`, `checkPermission` e RLS;
  - uso de secrets e service role nas functions;
  - risco de bypass no frontend;
  - dados sensíveis em Verbas, Controle PJ e API pública.

### 6. Integrations
- Foco: Edge Functions, DAB proxy, D4Sign, SMTP, WhatsApp, OpenAI e ElevenLabs.
- Dono de: contratos entre frontend, Supabase Functions e serviços externos.
- Deve validar:
  - payloads e tratamento de erro;
  - timeout/retry/fallback;
  - configuração por ambiente;
  - observabilidade e logs operacionais.

### 7. Product/Delivery
- Foco: recorte de escopo, dependências, aceite e rollout.
- Dono de: traduzir demanda em pacote de entrega executável.
- Deve validar:
  - impacto em módulos já estáveis;
  - necessidade de migration antes do frontend;
  - ordem de deploy;
  - checklist de aceite e rollback.

## Composição recomendada por tipo de demanda

### Feature simples de UI
- DEV
- UX
- QA

### Feature com dados novos
- DEV
- DBA
- QA
- Product/Delivery

### Feature com permissões ou módulo administrativo
- DEV
- DBA
- Security/RBAC
- QA

### Feature com integração externa
- DEV
- Integrations
- QA
- Product/Delivery

### Refactor sensível
- DEV
- QA
- Security/RBAC
- DBA

## Fluxo operacional

1. Product/Delivery define escopo, dependências e ordem de entrega.
2. UX e DEV alinham o fluxo da tela e o contrato dos dados.
3. DBA define ou revisa migration, RLS e impacto em dados existentes.
4. DEV implementa frontend e integração.
5. Security/RBAC revisa acesso se houver autenticação, permissão ou dado sensível.
6. QA executa smoke test e regressão dirigida.
7. Product/Delivery fecha rollout, risco residual e plano de deploy.

## Padrões obrigatórios para este projeto

- Toda mudança que toca dados deve considerar multiempresa.
- Toda mudança de acesso deve ser validada em frontend e backend.
- Toda feature com Supabase Function precisa de tratamento explícito de erro.
- Toda entrega deve passar por smoke test manual mínimo.
- Mudança em módulos sensíveis exige revisão cruzada:
  - `Governanca EC`
  - `Controle PJ`
  - `Verbas`
  - `Admin`
  - `Cockpit`

## Observações do estado atual

- Não há suíte automatizada de testes configurada no repositório.
- O projeto depende fortemente de validação manual e smoke test.
- O módulo de permissões merece atenção especial porque há lógica distribuída entre rota, role, permissão granular e RLS.
- Há forte acoplamento operacional com Supabase Edge Functions.
