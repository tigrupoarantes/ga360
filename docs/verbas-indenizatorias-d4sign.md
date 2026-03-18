# Verbas Indenizatórias — Especificação Técnica Completa

## Contexto de Negócio

O Grupo Arantes precisa gerar documentos de verbas indenizatórias para funcionários, enviá-los para assinatura digital via **D4Sign** e acompanhar o status de cada assinatura. O módulo será um novo card dentro da área **Pessoas & Cultura** da Governança EC.

### Problema que resolve
Hoje o processo de verbas indenizatórias é manual: o DP gera documentos, imprime, colhe assinatura física e arquiva. Com esta feature, todo o fluxo será digital, rastreável e integrado ao GA360.

### Quem usa
- **DP / RH**: Gera os documentos, acompanha assinaturas, reenvia quando necessário
- **Funcionários**: Recebem o documento e assinam digitalmente via D4Sign
- **Gestores / Diretores**: Acompanham status geral das assinaturas no dashboard

---

## Módulo e Rota

- **Módulo**: `governanca-ec` (Pessoas & Cultura)
- **Rota nova**: `/governanca-ec/pessoas-cultura/verbas-indenizatorias`
- **Rotas existentes modificadas**: nenhuma (card existente de Verbas não é alterado)

---

## Fluxo de Negócio

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. DP seleciona funcionário(s) com VERBA_INDENIZATORIA no Datalake │
│    (dados automáticos via payroll_verba_events / verbas-secure-query)│
├─────────────────────────────────────────────────────────────────────┤
│ 2. Sistema gera documento PDF a partir do template do DP           │
│    (preenchido com: nome, CPF, valores, competência, empresa)      │
├─────────────────────────────────────────────────────────────────────┤
│ 3. Documento é enviado para D4Sign via API                         │
│    (upload → cadastro de signatário → envio para assinatura)       │
├─────────────────────────────────────────────────────────────────────┤
│ 4. GA360 envia e-mail corporativo ao funcionário com instruções    │
│    (via send-email-smtp existente)                                 │
├─────────────────────────────────────────────────────────────────────┤
│ 5. Funcionário assina via D4Sign (link no e-mail da D4Sign)        │
├─────────────────────────────────────────────────────────────────────┤
│ 6. Webhook da D4Sign notifica GA360 sobre assinatura concluída     │
├─────────────────────────────────────────────────────────────────────┤
│ 7. GA360 atualiza status e faz download do doc assinado            │
│    (armazenado no Supabase Storage)                                │
├─────────────────────────────────────────────────────────────────────┤
│ 8. Dashboard mostra status consolidado por competência             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Impacto no Banco de Dados

### Tabelas novas

#### `d4sign_config`
Configuração da integração D4Sign (1 registro por company ou global).

```sql
CREATE TABLE public.d4sign_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  token_api TEXT NOT NULL,                    -- tokenAPI da D4Sign
  crypt_key TEXT NOT NULL,                    -- cryptKey da D4Sign
  safe_id TEXT,                               -- cofre padrão (UUID do cofre D4Sign)
  environment TEXT NOT NULL DEFAULT 'sandbox', -- 'sandbox' | 'production'
  base_url TEXT NOT NULL DEFAULT 'https://sandbox.d4sign.com.br/api/v1',
  webhook_url TEXT,                           -- URL do webhook para callbacks
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);
```

#### `d4sign_document_templates`
Templates de documentos (esqueletos do DP).

```sql
CREATE TABLE public.d4sign_document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                         -- "Termo de Verba Indenizatória"
  description TEXT,
  template_type TEXT NOT NULL DEFAULT 'verba_indenizatoria',
  -- Conteúdo do template (HTML com placeholders {{nome}}, {{cpf}}, etc.)
  template_html TEXT,
  -- Ou referência a arquivo no Storage
  template_file_path TEXT,
  -- Campos dinâmicos esperados no template
  fields_schema JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `verba_indenizatoria_documents`
Documentos gerados e seus status de assinatura.

```sql
CREATE TABLE public.verba_indenizatoria_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.d4sign_document_templates(id),

  -- Dados do funcionário (snapshot no momento da geração)
  employee_name TEXT NOT NULL,
  employee_cpf TEXT NOT NULL,
  employee_email TEXT,
  employee_department TEXT,
  employee_position TEXT,
  employee_unit TEXT,
  employee_accounting_group TEXT,

  -- Dados financeiros (snapshot do Datalake)
  competencia TEXT NOT NULL,                  -- "2026-03" (ano-mês)
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  valor_verba NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_adiantamento NUMERIC(14,2) NOT NULL DEFAULT 0,
  payload_json JSONB,                         -- Todos os dados usados na geração

  -- D4Sign
  d4sign_document_uuid TEXT,                  -- UUID do documento na D4Sign
  d4sign_safe_uuid TEXT,                      -- UUID do cofre na D4Sign
  d4sign_status TEXT NOT NULL DEFAULT 'draft',
  -- Status: draft | uploaded | signers_added | sent_to_sign |
  --         waiting_signature | signed | cancelled | expired | error
  d4sign_signer_key TEXT,                     -- key do signatário na D4Sign
  d4sign_signer_email TEXT,                   -- email usado para assinatura
  d4sign_sent_at TIMESTAMPTZ,
  d4sign_signed_at TIMESTAMPTZ,
  d4sign_cancelled_at TIMESTAMPTZ,
  d4sign_error_message TEXT,

  -- Arquivo gerado (antes de enviar para D4Sign)
  generated_file_path TEXT,                   -- path no Supabase Storage
  -- Arquivo assinado (após conclusão na D4Sign)
  signed_file_path TEXT,                      -- path no Supabase Storage

  -- Notificações
  email_sent_at TIMESTAMPTZ,
  email_reminder_count INTEGER NOT NULL DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,

  -- Controle
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_vi_docs_company_competencia
  ON public.verba_indenizatoria_documents (company_id, competencia);
CREATE INDEX idx_vi_docs_company_cpf
  ON public.verba_indenizatoria_documents (company_id, employee_cpf);
CREATE INDEX idx_vi_docs_d4sign_uuid
  ON public.verba_indenizatoria_documents (d4sign_document_uuid);
CREATE INDEX idx_vi_docs_status
  ON public.verba_indenizatoria_documents (d4sign_status);
```

#### `verba_indenizatoria_logs`
Log de auditoria de todas as ações.

```sql
CREATE TABLE public.verba_indenizatoria_logs (
  id BIGSERIAL PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.verba_indenizatoria_documents(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  -- Ações: created | uploaded_to_d4sign | signer_added | sent_to_sign |
  --        webhook_received | signed | downloaded | email_sent |
  --        reminder_sent | cancelled | error
  details JSONB,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vi_logs_document ON public.verba_indenizatoria_logs (document_id);
```

### RLS

```sql
-- d4sign_config: apenas service_role (chaves sensíveis)
ALTER TABLE public.d4sign_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only_d4sign_config"
  ON public.d4sign_config FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- d4sign_document_templates: autenticados podem ler, admin pode escrever
ALTER TABLE public.d4sign_document_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_templates"
  ON public.d4sign_document_templates FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "service_role_write_templates"
  ON public.d4sign_document_templates FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- verba_indenizatoria_documents: service_role (dados sensíveis como verbas)
ALTER TABLE public.verba_indenizatoria_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only_vi_documents"
  ON public.verba_indenizatoria_documents FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- verba_indenizatoria_logs: service_role
ALTER TABLE public.verba_indenizatoria_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only_vi_logs"
  ON public.verba_indenizatoria_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

### Migration necessária: SIM
### RLS necessária: SIM (todas as tabelas)

---

## Edge Functions Necessárias

### 1. `d4sign-proxy` — Gateway central D4Sign

Todas as chamadas à API D4Sign passam por esta Edge Function (nunca expor tokens no frontend).

```
POST /d4sign-proxy
Body: {
  action: 'list_safes' | 'upload_document' | 'add_signer' | 'send_to_sign' |
          'get_document' | 'list_documents' | 'download_document' | 'cancel_document',
  companyId: UUID,
  payload: { ... } // parâmetros específicos da ação
}
```

**Ações:**

| Ação | D4Sign Endpoint | Descrição |
|------|----------------|-----------|
| `list_safes` | `GET /safes` | Listar cofres disponíveis |
| `upload_document` | `POST /documents/{safe_uuid}/upload` | Upload de documento para o cofre |
| `add_signer` | `POST /documents/{doc_uuid}/createlist` | Adicionar signatário |
| `send_to_sign` | `POST /documents/{doc_uuid}/sendtosign` | Enviar para assinatura |
| `get_document` | `GET /documents/{doc_uuid}` | Status do documento |
| `list_documents` | `GET /documents/{safe_uuid}/list` | Listar documentos do cofre |
| `download_document` | `POST /documents/{doc_uuid}/download` | Download do documento assinado |
| `cancel_document` | `POST /documents/{doc_uuid}/cancel` | Cancelar documento |
| `register_webhook` | `POST /documents/{doc_uuid}/webhooks` | Registrar webhook |

### 2. `d4sign-webhook` — Recebe callbacks da D4Sign

```
POST /d4sign-webhook (público, sem auth — validar por token)
Body: {
  uuid: "document-uuid",
  type_post: "1" | "2" | "3" | "4",
  // 1 = documento finalizado
  // 2 = documento cancelado
  // 3 = assinatura realizada
  // 4 = e-mail não entregue
}
```

**Responsabilidades:**
- Validar autenticidade do callback
- Atualizar `d4sign_status` em `verba_indenizatoria_documents`
- Registrar log em `verba_indenizatoria_logs`
- Se assinatura concluída: fazer download do doc assinado e salvar no Storage
- Se cancelado: atualizar status

### 3. `generate-verba-indenizatoria-doc` — Gerar documento

```
POST /generate-verba-indenizatoria-doc
Body: {
  companyId: UUID,
  employeeCpf: string,
  competencia: string,    // "2026-03"
  templateId: UUID,
  sendToSign?: boolean,   // se true, já envia para D4Sign após gerar
}
```

**Responsabilidades:**
1. Buscar dados do funcionário no Datalake (VERBA_INDENIZATORIA + ADIANTAMENTO)
2. Buscar template do banco
3. Preencher template com dados (usando placeholders)
4. Gerar PDF (jsPDF ou html-pdf no Deno)
5. Salvar no Supabase Storage (`verbas-indenizatorias/{company_id}/{competencia}/{cpf}.pdf`)
6. Criar registro em `verba_indenizatoria_documents`
7. Se `sendToSign`: chamar d4sign-proxy para upload + signer + envio
8. Registrar logs

### 4. `verba-indenizatoria-query` — Consultar documentos

```
POST /verba-indenizatoria-query
Body: {
  companyId: UUID,
  competencia?: string,
  cpf?: string,
  status?: string,
  page?: number,
  pageSize?: number,
}
```

**Responsabilidades:**
- Consultar `verba_indenizatoria_documents` com filtros
- Verificar permissão do card EC (has_card_permission)
- Retornar lista paginada com dados de status

### 5. `send-verba-indenizatoria-notification` — E-mail corporativo

```
POST /send-verba-indenizatoria-notification
Body: {
  documentId: UUID,
  type: 'initial' | 'reminder',
}
```

**Responsabilidades:**
- Buscar dados do documento e funcionário
- Enviar e-mail via SMTP corporativo (reutilizar `send-email-smtp`)
- Template: nome do funcionário, competência, link para assinatura, instruções
- Atualizar `email_sent_at` / `email_reminder_count`

---

## Componentes Frontend

### Páginas novas

#### `src/pages/VerbasIndenizatorias.tsx`
Página principal do card, com:
- **Dashboard de status**: cards com contadores (pendentes, aguardando assinatura, assinados, erros)
- **Filtros**: competência (mês/ano), empresa, status, busca por nome/CPF
- **Tabela de documentos**: lista com nome, CPF, competência, valor, status, ações
- **Ações por documento**: ver PDF, reenviar, cancelar, baixar assinado
- **Ação em lote**: gerar documentos para todos os funcionários de uma competência

### Componentes novos em `src/components/verbas-indenizatorias/`

| Componente | Responsabilidade |
|------------|-----------------|
| `VIStatusDashboard.tsx` | Cards com KPIs (total, pendentes, assinados, % conclusão) |
| `VIDocumentTable.tsx` | Tabela com lista de documentos e ações inline |
| `VIDocumentRow.tsx` | Linha da tabela com status badge e botões |
| `VIGenerateDialog.tsx` | Dialog para gerar documento (selecionar funcionário, competência, template) |
| `VIBatchGenerateDialog.tsx` | Dialog para geração em lote por competência |
| `VIDocumentPreview.tsx` | Preview do PDF gerado antes de enviar |
| `VIStatusBadge.tsx` | Badge colorido por status D4Sign |
| `VIFilters.tsx` | Filtros de competência, status, busca |
| `VIDocumentDetail.tsx` | Detalhes completos de um documento (timeline de eventos) |
| `VITimelineLog.tsx` | Timeline visual do histórico de ações |

### Componentes de Admin em `src/components/admin/`

| Componente | Responsabilidade |
|------------|-----------------|
| `D4SignConfigForm.tsx` | Formulário para configurar tokenAPI, cryptKey, safe, ambiente |
| `D4SignConfigStatus.tsx` | Indicador de status da conexão (testar credenciais) |
| `D4SignTemplateManager.tsx` | CRUD de templates de documentos |
| `D4SignTemplateEditor.tsx` | Editor de template com preview de placeholders |

### Hooks novos

| Hook | Responsabilidade |
|------|-----------------|
| `useVerbasIndenizatorias.ts` | Query principal: listar documentos com filtros |
| `useVIGenerate.ts` | Mutation: gerar documento |
| `useVIBatchGenerate.ts` | Mutation: gerar em lote |
| `useVISendToSign.ts` | Mutation: enviar para assinatura D4Sign |
| `useVICancel.ts` | Mutation: cancelar documento |
| `useVIResend.ts` | Mutation: reenviar notificação |
| `useD4SignConfig.ts` | Query/Mutation: configuração D4Sign no Admin |

---

## Permissões

### Roles que podem acessar
- **super_admin / ceo**: acesso total (gerar, enviar, cancelar, configurar)
- **diretor / gerente** (com permissão no card): visualizar status, gerar documentos
- **colaborador**: sem acesso (assina externamente via D4Sign)

### Permissão por card EC
Reutilizar sistema existente `useCardPermissions(cardId)`:
- `can_view`: ver dashboard e status dos documentos
- `can_fill`: gerar documentos e enviar para assinatura
- `can_review`: aprovar geração em lote, ver logs
- `can_manage`: configurar templates, cancelar documentos

### Proteção de rota
```tsx
<Route path="/governanca-ec/pessoas-cultura/verbas-indenizatorias" element={
  <ProtectedRoute requiredPermission={{ module: 'governanca', action: 'view' }}>
    <VerbasIndenizatorias />
  </ProtectedRoute>
} />
```

---

## Integrações Externas

| Integração | Uso | Edge Function |
|------------|-----|---------------|
| **D4Sign API** | Upload, assinatura, download, webhook | `d4sign-proxy`, `d4sign-webhook` |
| **Datalake** | Dados de VERBA_INDENIZATORIA por funcionário | `verbas-secure-query` (existente) |
| **E-mail SMTP** | Notificação corporativa ao funcionário | `send-verba-indenizatoria-notification` |
| **Supabase Storage** | Armazenar PDFs gerados e assinados | Bucket: `verbas-indenizatorias` |

---

## API D4Sign — Referência

### Autenticação
Toda requisição inclui query params: `?tokenAPI={token}&cryptKey={crypt}`

### Fluxo de integração

```
1. GET /safes                                    → Listar cofres
2. POST /documents/{safe_uuid}/upload            → Upload do PDF
3. POST /documents/{doc_uuid}/createlist         → Adicionar signatário(s)
   Body: { signers: [{ email, act: "1", ... }] }
4. POST /documents/{doc_uuid}/webhooks           → Registrar webhook
   Body: { url: "https://...d4sign-webhook" }
5. POST /documents/{doc_uuid}/sendtosign         → Enviar para assinatura
   Body: { message: "Por favor, assine..." }
6. [WEBHOOK] POST callback                       → D4Sign notifica assinatura
7. POST /documents/{doc_uuid}/download           → Download do doc assinado
```

### Ambientes
- **Sandbox**: `https://sandbox.d4sign.com.br/api/v1`
- **Produção**: `https://secure.d4sign.com.br/api/v1`

---

## Placeholders do Template

Campos disponíveis para substituição no template do DP:

| Placeholder | Fonte | Exemplo |
|-------------|-------|---------|
| `{{nome_funcionario}}` | Datalake | "João da Silva" |
| `{{cpf}}` | Datalake | "123.456.789-00" |
| `{{empresa}}` | Datalake (razao_social) | "CHOK DISTRIBUIDORA" |
| `{{departamento}}` | Datalake | "Comercial" |
| `{{cargo}}` | Datalake | "Vendedor" |
| `{{unidade}}` | Datalake | "Matriz" |
| `{{competencia}}` | Seleção do DP | "Março/2026" |
| `{{valor_verba}}` | Datalake (VERBA_INDENIZATORIA) | "R$ 1.500,00" |
| `{{valor_adiantamento}}` | Datalake (ADIANTAMENTO) | "R$ 500,00" |
| `{{valor_total}}` | Calculado | "R$ 2.000,00" |
| `{{data_geracao}}` | Sistema | "15/03/2026" |
| `{{grupo_contabilizacao}}` | Datalake | "CHOK AGRO" |

---

## Supabase Storage — Bucket

```sql
-- Criar bucket para documentos de verbas indenizatórias
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verbas-indenizatorias',
  'verbas-indenizatorias',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf']::text[]
);
```

Estrutura de paths:
```
verbas-indenizatorias/
├── {company_id}/
│   ├── templates/
│   │   └── {template_id}.html
│   ├── generated/
│   │   └── {competencia}/
│   │       └── {cpf}_{timestamp}.pdf
│   └── signed/
│       └── {competencia}/
│           └── {cpf}_{d4sign_uuid}_signed.pdf
```

---

## Fases de Implementação

### Fase 1 — Banco de dados + Storage (1 dia)
- [ ] Migration: criar tabelas `d4sign_config`, `d4sign_document_templates`, `verba_indenizatoria_documents`, `verba_indenizatoria_logs`
- [ ] RLS em todas as tabelas
- [ ] Criar bucket `verbas-indenizatorias` no Storage
- [ ] Atualizar tipos TypeScript (`types.ts`)
- [ ] Seed: criar card EC "Verbas Indenizatórias" na área Pessoas & Cultura

### Fase 2 — Edge Functions D4Sign (2-3 dias)
- [ ] `d4sign-proxy`: gateway com todas as ações
- [ ] `d4sign-webhook`: receptor de callbacks
- [ ] `generate-verba-indenizatoria-doc`: geração de PDF a partir de template
- [ ] `verba-indenizatoria-query`: consulta segura de documentos
- [ ] `send-verba-indenizatoria-notification`: e-mail corporativo
- [ ] Testes com sandbox D4Sign

### Fase 3 — Admin UI (1 dia)
- [ ] Página de configuração D4Sign no Admin
- [ ] Formulário de credenciais com teste de conexão
- [ ] Gerenciador de templates (CRUD)

### Fase 4 — Frontend principal (3-4 dias)
- [ ] Página `VerbasIndenizatorias.tsx` com dashboard de status
- [ ] Tabela de documentos com filtros e ações
- [ ] Dialog de geração individual (selecionar funcionário + competência)
- [ ] Dialog de geração em lote
- [ ] Preview de PDF gerado
- [ ] Timeline de eventos por documento
- [ ] Status badges com cores
- [ ] Integração com card permissions

### Fase 5 — Notificações + Webhook (1 dia)
- [ ] E-mail corporativo com template HTML
- [ ] Lógica de reenvio/lembrete
- [ ] Processamento de webhook (atualização de status, download de doc assinado)

### Fase 6 — Testes e refinamento (1-2 dias)
- [ ] Testes end-to-end no sandbox D4Sign
- [ ] Validação de permissões e isolamento multi-company
- [ ] Testes de geração em lote
- [ ] Tratamento de erros e edge cases

---

## Estimativa Total: 9-12 dias de desenvolvimento

---

## Riscos e Dependências

| Risco | Mitigação |
|-------|-----------|
| Template do DP ainda não recebido | Estrutura técnica suporta template placeholder; basta trocar quando chegar |
| Limites da API D4Sign (rate limiting) | Implementar fila/retry na geração em lote |
| E-mail do funcionário pode estar desatualizado | Validar e-mail antes do envio; permitir edição manual |
| Webhook pode falhar | Implementar polling periódico como fallback |
| Dados do Datalake podem estar desatualizados | Forçar sync antes de gerar documentos |

---

## Critérios de Aceite

- [ ] DP consegue configurar credenciais D4Sign no Admin
- [ ] DP consegue fazer upload/criar templates de documento
- [ ] Sistema puxa automaticamente dados de VERBA_INDENIZATORIA do Datalake
- [ ] Documento PDF é gerado corretamente com dados do funcionário
- [ ] Documento é enviado para D4Sign e signatário é cadastrado
- [ ] Funcionário recebe e-mail corporativo com instruções
- [ ] Assinatura no D4Sign atualiza status no GA360 (via webhook)
- [ ] Documento assinado é baixado e armazenado no Storage
- [ ] Dashboard mostra visão consolidada por competência
- [ ] Geração em lote funciona para todos os funcionários de uma competência
- [ ] Permissões por card EC funcionam corretamente
- [ ] Logs de auditoria registram todas as ações
