
# Plano: Implementação do Módulo de Auditoria de Estoque

## Visão Geral

Criar um módulo completo de Auditoria de Estoque (Cycle Count) dentro do Card de Auditoria na área de Governança EC, seguindo os princípios iOS/Steve Jobs definidos no PRD.

---

## Decisões Consolidadas

| Item | Decisão |
|------|---------|
| Unidades | Usar tabela `companies` existente (6 empresas já cadastradas) |
| Estrutura | Criar dentro do Card de Auditoria (área Governança EC) |
| Amostragem | Incluída na Fase 1 |
| Assinatura | Apenas Nome + CPF na Fase 1 (canvas para fases futuras) |
| Base de estoque | CSV/XLS importado a cada auditoria |

---

## Arquitetura

```text
GovernancaEC (/governanca-ec)
└── Área: Auditoria (/governanca-ec/auditoria)
    └── Card: Auditoria de Estoque
        └── Clique → Abre Módulo de Auditoria
            ├── Passo 1: Escolher Unidade (company)
            ├── Passo 2: Importar Base CSV/XLS
            ├── Passo 3: Gerar Amostra
            ├── Passo 4: Contagem (modo checklist)
            └── Passo 5: Finalização + Testemunha
```

---

## Fase 1 - Banco de Dados

### Novas Tabelas

#### 1. `stock_audit_settings` (configurações globais)
```sql
CREATE TABLE stock_audit_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  governance_email TEXT,
  cc_emails JSONB DEFAULT '[]',
  default_sample_size INTEGER DEFAULT 30,
  default_tolerance_abs NUMERIC DEFAULT 1,
  default_tolerance_pct NUMERIC DEFAULT 5,
  default_blind_count_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### 2. `stock_audits` (auditorias)
```sql
CREATE TABLE stock_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  unit_id UUID NOT NULL REFERENCES companies(id), -- unidade = empresa
  auditor_user_id UUID NOT NULL REFERENCES profiles(id),
  card_id UUID REFERENCES ec_cards(id),
  
  -- Datas
  planned_date DATE,
  executed_date DATE,
  cutoff_datetime TIMESTAMPTZ,
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'reviewed')),
  
  -- Configurações da auditoria
  blind_count_enabled BOOLEAN DEFAULT true,
  sample_size INTEGER,
  sampling_method TEXT DEFAULT 'random',
  
  -- Arquivo base
  base_file_url TEXT,
  base_file_type TEXT,
  base_file_meta JSONB,
  total_items_loaded INTEGER,
  
  -- Movimentação
  movement_during_audit BOOLEAN DEFAULT false,
  movement_notes TEXT,
  
  -- Testemunha
  witness_name TEXT,
  witness_cpf TEXT,
  witness_term_accepted BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### 3. `stock_audit_items` (itens da auditoria)
```sql
CREATE TABLE stock_audit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_audit_id UUID NOT NULL REFERENCES stock_audits(id) ON DELETE CASCADE,
  
  -- Dados do SKU
  sku_code TEXT NOT NULL,
  sku_description TEXT,
  uom TEXT, -- unidade de medida
  location TEXT,
  
  -- Quantidades
  system_qty NUMERIC NOT NULL,
  physical_qty NUMERIC,
  recount_qty NUMERIC,
  final_physical_qty NUMERIC,
  final_diff_qty NUMERIC,
  
  -- Status
  result TEXT DEFAULT 'pending' CHECK (result IN ('pending', 'ok', 'divergent', 'recount_required', 'divergent_confirmed')),
  is_in_sample BOOLEAN DEFAULT false,
  
  -- Causa raiz
  root_cause_code TEXT,
  root_cause_notes TEXT,
  item_notes TEXT,
  
  -- Timestamps
  audited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### 4. `stock_audit_item_photos` (fotos)
```sql
CREATE TABLE stock_audit_item_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_audit_item_id UUID NOT NULL REFERENCES stock_audit_items(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Storage Bucket
```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('stock-audit-files', 'stock-audit-files', false);
```

### RLS Policies
- Auditorias: leitura para usuários autenticados da mesma empresa
- Escrita: apenas auditores e admins

---

## Fase 1 - Componentes React

### Estrutura de Pastas
```text
src/components/stock-audit/
├── StockAuditWizard.tsx        # Wizard principal (5 passos)
├── steps/
│   ├── UnitSelector.tsx        # Passo 1: Escolher unidade
│   ├── BaseUploader.tsx        # Passo 2: Upload CSV/XLS
│   ├── SampleGenerator.tsx     # Passo 3: Gerar amostra
│   ├── CountingChecklist.tsx   # Passo 4: Contagem item a item
│   └── AuditFinalization.tsx   # Passo 5: Resumo + Testemunha
├── components/
│   ├── CountingCard.tsx        # Card grande por SKU
│   ├── PhotoCapture.tsx        # Botão câmera
│   ├── WitnessForm.tsx         # Nome + CPF
│   ├── AuditSummary.tsx        # Resumo final
│   └── AuditHistory.tsx        # Histórico de auditorias
└── hooks/
    ├── useStockAudit.ts        # Hook principal
    └── useSampling.ts          # Lógica de amostragem
```

### Páginas
```text
src/pages/
├── StockAuditStart.tsx         # Lista unidades + histórico
└── StockAuditExecution.tsx     # Wizard de execução
```

### Rotas
```typescript
// App.tsx - novas rotas
<Route path="/governanca-ec/auditoria/estoque" element={<StockAuditStart />} />
<Route path="/governanca-ec/auditoria/estoque/:auditId" element={<StockAuditExecution />} />
```

---

## Fase 1 - UX iOS (Fluxo Simplificado)

### Passo 1: Escolher Unidade
- Cards grandes com as 6 empresas
- Badge de status: "Pendente este mês" / "Concluída"
- Um toque → "Iniciar Auditoria"

### Passo 2: Upload Base
- Área de drag & drop
- Aceita CSV e XLS
- Detecção automática de colunas
- Mapeamento simplificado (SKU, Descrição, Qtd, UM)
- Preview dos dados

### Passo 3: Amostra
- Exibe total de itens carregados
- Campo para definir tamanho da amostra (default: 30)
- Opção: "Incluir críticos" (se houver)
- Botão: "Gerar Amostra" → seleciona aleatoriamente
- Exibe itens selecionados

### Passo 4: Contagem
- Um card grande por vez
- Mostra: SKU, Descrição, UM, Local
- Campo grande para quantidade física
- Contagem cega ON: não mostra qtd sistema até salvar
- Após salvar: mostra divergência com cores
- Botões: Foto | Observação | Próximo
- Progresso: "5/30 itens"

### Passo 5: Finalização
- Resumo: OK / Divergentes / Recontados
- Toggle: "Houve movimentação?"
- Formulário testemunha: Nome + CPF
- Checkbox: "Declaro que acompanhei a auditoria"
- Botão: "Concluir Auditoria"

---

## Fase 1 - Implementação Detalhada

### 1. Migração SQL
Criar todas as tabelas, indexes e RLS policies.

### 2. Componente UnitSelector
```typescript
interface UnitSelectorProps {
  onSelect: (unitId: string) => void;
}
// Usa companies como unidades
// Mostra status do mês atual (query em stock_audits)
```

### 3. Componente BaseUploader
```typescript
interface BaseUploaderProps {
  auditId: string;
  onComplete: (itemCount: number) => void;
}
// Reutiliza lógica do CsvImporter existente
// Campos mapeáveis: sku_code, sku_description, system_qty, uom, location
```

### 4. Componente SampleGenerator
```typescript
interface SampleGeneratorProps {
  auditId: string;
  totalItems: number;
  onSampleReady: () => void;
}
// Algoritmo de amostragem aleatória
// Atualiza is_in_sample nos itens
```

### 5. Componente CountingChecklist
```typescript
interface CountingChecklistProps {
  auditId: string;
  onComplete: () => void;
}
// Query apenas itens com is_in_sample = true
// Navegação: anterior/próximo
// Salva physical_qty e calcula divergência
```

### 6. Componente AuditFinalization
```typescript
interface AuditFinalizationProps {
  auditId: string;
  onComplete: () => void;
}
// Resumo de contagens
// Form testemunha (nome + CPF)
// Botão concluir
```

---

## Integração com Card de Auditoria

O Card "Auditoria de Estoque" na área de Auditoria terá um comportamento especial:

1. Ao clicar no card, em vez de abrir o detalhe padrão, redireciona para `/governanca-ec/auditoria/estoque`
2. O card exibe badge com status do mês atual
3. Contagem de auditorias pendentes/concluídas

```typescript
// ECCard.tsx - adicionar condição especial
if (card.title === "Auditoria de Estoque" || card.audit_type === "stock") {
  navigate("/governanca-ec/auditoria/estoque");
  return;
}
```

---

## Fases Futuras (Roadmap)

### Fase 2 - Melhorias de Campo
- Recontagem guiada com tolerância
- Busca e filtros na contagem
- Indicador de progresso visual
- Causa raiz obrigatória para divergência confirmada

### Fase 3 - Relatório IA
- Geração automática de relatório
- Envio por email para Governança
- Template configurável

### Fase 4 - Assinatura e Escala
- Canvas de assinatura digital
- Painel de cobertura mensal
- Alertas de pendências
- Críticos por unidade

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar tabelas + RLS + storage |
| `src/components/stock-audit/StockAuditWizard.tsx` | Criar wizard principal |
| `src/components/stock-audit/steps/UnitSelector.tsx` | Criar seletor de unidades |
| `src/components/stock-audit/steps/BaseUploader.tsx` | Criar upload CSV/XLS |
| `src/components/stock-audit/steps/SampleGenerator.tsx` | Criar gerador de amostra |
| `src/components/stock-audit/steps/CountingChecklist.tsx` | Criar checklist de contagem |
| `src/components/stock-audit/steps/AuditFinalization.tsx` | Criar finalização |
| `src/components/stock-audit/components/CountingCard.tsx` | Criar card de contagem |
| `src/components/stock-audit/components/PhotoCapture.tsx` | Criar captura de foto |
| `src/components/stock-audit/components/WitnessForm.tsx` | Criar form testemunha |
| `src/pages/StockAuditStart.tsx` | Criar página inicial |
| `src/pages/StockAuditExecution.tsx` | Criar página de execução |
| `src/App.tsx` | Adicionar rotas |
| `src/components/governanca-ec/ECCard.tsx` | Adicionar redirecionamento especial |

---

## Critérios de Aceite (Fase 1)

1. Auditor consegue iniciar auditoria em < 30 segundos
2. Contagem de um item leva < 10 segundos
3. Upload de CSV funciona com detecção automática
4. Amostragem gera X itens aleatórios
5. Contagem cega funciona (não mostra qtd sistema antes de salvar)
6. Finalização coleta Nome + CPF da testemunha
7. Todos os dados salvos automaticamente (sem perda)
8. Histórico de auditorias visível
