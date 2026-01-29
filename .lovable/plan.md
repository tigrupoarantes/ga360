

# Plano: Configuração de Destinatários + Visualização de Relatórios no Histórico

## Resumo

Implementar 3 funcionalidades:
1. **Tela de configuração** dos e-mails destinatários do relatório de auditoria
2. **Visualização do relatório** ao clicar em uma auditoria concluída no histórico
3. **Opção de gerar/regenerar relatório** quando não houver ou para reenviar

---

## Arquitetura Atual

A tabela `stock_audit_settings` já possui os campos necessários:
- `governance_email` → E-mail principal do responsável
- `cc_emails` → Lista JSON de e-mails em cópia

Porém, a tabela `stock_audits` não armazena o relatório gerado. Precisamos adicionar campos para isso.

---

## Mudanças no Banco de Dados

### Adicionar colunas na tabela stock_audits

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `report_html` | `text` | Conteúdo HTML do relatório gerado |
| `report_sent_at` | `timestamptz` | Data/hora do envio do email |
| `report_sent_to` | `text[]` | Lista de emails que receberam |

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| **Migração SQL** | Adicionar colunas `report_html`, `report_sent_at`, `report_sent_to` |
| `src/components/settings/StockAuditSettingsSection.tsx` | **Criar** - Form para configurar emails |
| `src/pages/AdminSettings.tsx` | **Modificar** - Adicionar nova aba "Auditoria" |
| `supabase/functions/generate-stock-audit-report/index.ts` | **Modificar** - Salvar HTML no banco |
| `src/pages/StockAuditExecution.tsx` | **Modificar** - Exibir relatório e botão regenerar |
| `src/hooks/useStockAudit.ts` | **Modificar** - Adicionar função regenerateReport |

---

## Detalhes das Implementações

### 1. Nova Aba em Configurações: "Auditoria de Estoque"

Local: `/admin/settings` → Nova aba

```text
┌─────────────────────────────────────────────────────────────┐
│  📦 Configurações de Auditoria de Estoque                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  E-mail do Responsável (Governança) *                       │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ fabiano.dias@grupoarantes.com.br                      │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  E-mails em Cópia (um por linha)                           │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ controladoria@grupoarantes.com.br                     │ │
│  │ diretor@grupoarantes.com.br                           │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           💾 Salvar Configurações                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. Visualização do Relatório (Auditoria Concluída)

Ao clicar em uma auditoria concluída no histórico, mostrar:

```text
┌─────────────────────────────────────────────────────────────┐
│  ✅ Auditoria Concluída                                     │
│  Unidade: Chok Distribuidora                                │
│  Concluída em: 29/01/2026 às 14:30                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📊 Resumo                                                  │
│  ┌───────┬───────┬────────────┬────────────┐               │
│  │ Total │  OK   │ Divergente │ Recontado  │               │
│  │   6   │   1   │     5      │     0      │               │
│  └───────┴───────┴────────────┴────────────┘               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📧 Relatório                                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ✅ Enviado em 29/01/2026 às 14:32                  │   │
│  │  Para: fabiano.dias@grupoarantes.com.br             │   │
│  │                                                     │   │
│  │  [👁 Ver Relatório]  [📧 Reenviar]                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  --- OU, se não houver relatório ---                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ⚠️ Relatório não gerado                            │   │
│  │                                                     │   │
│  │  [📄 Gerar Relatório]                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. Visualização do HTML do Relatório

Ao clicar em "Ver Relatório":
- Abrir Dialog/Modal com o HTML renderizado
- Opção de abrir em nova aba para impressão

---

## Fluxo Completo

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   [Admin] Configura emails em /admin/settings → aba "Auditoria"         │
│       │                                                                  │
│       ▼                                                                  │
│   [Auditor] Realiza auditoria e clica "Concluir"                        │
│       │                                                                  │
│       ▼                                                                  │
│   [Sistema] Salva auditoria + gera relatório IA + envia email           │
│       │                                                                  │
│       ├─── Salva report_html, report_sent_at, report_sent_to            │
│       │                                                                  │
│       ▼                                                                  │
│   [Histórico] Auditor/Admin clica na auditoria                          │
│       │                                                                  │
│       ├─── Se tem relatório → mostra "Ver Relatório" + "Reenviar"       │
│       └─── Se não tem → mostra "Gerar Relatório"                        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Modificação da Edge Function

A função `generate-stock-audit-report` será atualizada para:

1. **Salvar o HTML** na coluna `report_html` da auditoria
2. **Registrar** `report_sent_at` e `report_sent_to` após envio
3. **Aceitar flag `resend`** para reenviar relatório existente

```typescript
// Após gerar HTML e enviar email:
await supabase
  .from("stock_audits")
  .update({
    report_html: htmlReport,
    report_sent_at: new Date().toISOString(),
    report_sent_to: emailTo,
  })
  .eq("id", auditId);
```

---

## Campos de Configuração

### Tabela stock_audit_settings

| Campo | Valor Exemplo |
|-------|---------------|
| `governance_email` | fabiano.dias@grupoarantes.com.br |
| `cc_emails` | ["controladoria@grupoarantes.com.br"] |

Se não existir registro, criar ao salvar.

---

## Resumo das Entregas

| Funcionalidade | Onde |
|----------------|------|
| Configurar emails destinatários | `/admin/settings` → aba "Auditoria" |
| Ver relatório de auditoria concluída | Clique na auditoria no histórico |
| Gerar relatório se não existir | Botão na tela de detalhes |
| Reenviar relatório | Botão na tela de detalhes |

