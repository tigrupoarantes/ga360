

# Plano: Relatório Automático de Auditoria de Estoque com IA

## Visão Geral

Implementar a geração automática de relatório de auditoria de estoque ao finalizar uma auditoria. O relatório será:
1. **Gerado por IA** com análise de divergências e causa raiz
2. **Formatado em PDF** profissional
3. **Enviado por e-mail** para o responsável da Governança

---

## Arquitetura

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                       FLUXO DE FINALIZAÇÃO                               │
│                                                                          │
│  [1] AuditFinalization.tsx                                              │
│       │                                                                  │
│       ▼ Ao clicar "Concluir Auditoria"                                  │
│  [2] useStockAudit.completeAudit()                                      │
│       │                                                                  │
│       ▼ Após salvar status = "completed"                                │
│  [3] Chama edge function: generate-stock-audit-report                  │
│       │                                                                  │
│       ├─── Busca dados da auditoria no banco                           │
│       ├─── Busca settings (governance_email, cc_emails)                │
│       ├─── Chama Lovable AI para análise                               │
│       ├─── Gera PDF com os dados + análise                             │
│       └─── Envia email via Resend com PDF anexo                        │
│                                                                          │
│  [4] Toast de sucesso/erro para o auditor                               │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/generate-stock-audit-report/index.ts` | **Criar** - Edge function principal |
| `supabase/config.toml` | **Modificar** - Adicionar nova função |
| `src/hooks/useStockAudit.ts` | **Modificar** - Chamar edge function após completar |
| `src/components/stock-audit/steps/AuditFinalization.tsx` | **Modificar** - Adicionar feedback de envio |

---

## Detalhes da Implementação

### 1. Edge Function: generate-stock-audit-report

**Responsabilidades:**
- Receber `auditId` no request
- Buscar dados completos da auditoria e itens
- Buscar configurações de email (`stock_audit_settings`)
- Chamar Lovable AI para análise de divergências
- Gerar PDF via serviço externo ou HTML inline
- Enviar email via Resend

**Dados para o relatório:**

| Seção | Conteúdo |
|-------|----------|
| Cabeçalho | Logo, Data, Unidade |
| Resumo | Total contado, OK, Divergentes, Recontados |
| Divergências | Tabela com SKU, Descrição, Sistema vs Físico, Diferença |
| Análise IA | Padrões identificados, possíveis causas, recomendações |
| Testemunha | Nome, CPF, Declaração |
| Movimentação | Se houve, notas explicativas |

**Prompt para IA:**

```text
Você é um especialista em auditoria de estoque e controles internos.
Analise os dados desta auditoria e forneça:
1. Resumo executivo (2-3 frases)
2. Análise das divergências encontradas
3. Possíveis causas raiz
4. Recomendações de ação corretiva
5. Nível de risco (Baixo/Médio/Alto)
```

### 2. Modificações no useStockAudit.ts

Após `completeAudit.mutateAsync()` retornar sucesso:
- Chamar `supabase.functions.invoke('generate-stock-audit-report')`
- Tratar erros silenciosamente (não bloquear o fluxo)
- Mostrar toast de sucesso quando email for enviado

### 3. Modificações no AuditFinalization.tsx

- Adicionar estado para tracking do envio de email
- Mostrar indicador "Enviando relatório..." após concluir
- Exibir mensagem de sucesso quando email for disparado

---

## Template do Email

```html
Assunto: [Auditoria Estoque] {Unidade} - {Data}

Olá,

A auditoria de estoque da unidade {Unidade} foi concluída.

RESUMO:
- Total de itens contados: X
- Itens OK: X (X%)
- Divergências: X (X%)

O relatório completo está anexo a este email.

Atenciosamente,
GA 360 - Governança Corporativa
```

---

## Estrutura do PDF (via HTML inline no email ou base64)

```text
┌─────────────────────────────────────────────────────────────┐
│  [LOGO GA360]        RELATÓRIO DE AUDITORIA DE ESTOQUE     │
│                      Data: dd/mm/yyyy                       │
├─────────────────────────────────────────────────────────────┤
│  UNIDADE: Chok Distribuidora de Alimentos Ltda.            │
│  AUDITOR: Nome do Auditor                                   │
│  TESTEMUNHA: William Cintra (CPF: 357.553.898-02)          │
├─────────────────────────────────────────────────────────────┤
│  RESUMO EXECUTIVO                                           │
│  ┌───────┬───────┬────────────┬────────────┐               │
│  │ Total │  OK   │ Divergente │ Recontado  │               │
│  │   6   │   1   │     5      │     0      │               │
│  └───────┴───────┴────────────┴────────────┘               │
├─────────────────────────────────────────────────────────────┤
│  ITENS DIVERGENTES                                          │
│  ┌────────────┬─────────────────────┬────────┬─────────┐   │
│  │   Código   │     Descrição       │Sistema │ Físico  │   │
│  │ 900008581  │ BALY 473ML COCO     │  648   │  1500   │   │
│  │ ...        │ ...                 │  ...   │  ...    │   │
│  └────────────┴─────────────────────┴────────┴─────────┘   │
├─────────────────────────────────────────────────────────────┤
│  ANÁLISE E RECOMENDAÇÕES (Gerada por IA)                   │
│                                                             │
│  [Texto gerado pelo Lovable AI com análise de padrões,     │
│   possíveis causas e recomendações de ação]                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  NÍVEL DE RISCO: [ALTO/MÉDIO/BAIXO]                        │
├─────────────────────────────────────────────────────────────┤
│  OBSERVAÇÕES                                                │
│  [X] Movimentação durante auditoria: Não                   │
│                                                             │
│  Gerado em: dd/mm/yyyy às HH:mm                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Configuração Necessária

### Tabela stock_audit_settings

Verificar se existe registro e se `governance_email` está preenchido:

```sql
-- Se não existir, criar registro padrão
INSERT INTO stock_audit_settings (governance_email)
VALUES ('fabiano.dias@grupoarantes.com.br')
ON CONFLICT DO NOTHING;
```

---

## Fluxo do Auditor (Atualizado)

```text
1. Auditor preenche dados da testemunha
2. Clica "Concluir Auditoria"
3. Sistema salva status = "completed"
4. Mostra: "Gerando relatório..."
5. Edge function processa e envia email
6. Mostra: "Auditoria concluída! Relatório enviado para governança."
7. Redireciona para lista de auditorias
```

---

## Tratamento de Erros

| Cenário | Comportamento |
|---------|---------------|
| Email não configurado | Continua sem enviar, log de warning |
| Falha na IA | Gera relatório sem seção de análise |
| Falha no Resend | Toast de aviso, mas auditoria já está salva |
| Rate limit IA | Usa fallback com texto padrão |

