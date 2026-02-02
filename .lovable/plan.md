
## Plano: Simplificar Formulário de Cards do Escritório Central

Este plano reorganiza o formulário de criação de cards para ser amigável a usuários comuns, escondendo campos técnicos avançados.

---

## Problema Atual

O formulário atual exige que o usuário preencha:

| Campo | Complexidade | Necessário? |
|-------|--------------|-------------|
| Título | Simples | Sim |
| Descrição | Simples | Sim |
| Periodicidade | Simples | Sim |
| Responsável | Simples | Sim |
| Backup | Simples | Opcional |
| Dias para Risco | Médio | Pode ter default |
| Campos Manuais (JSON) | Técnico | Avançado |
| Checklist Template (JSON) | Técnico | Avançado |
| Regras de Vencimento (JSON) | Técnico | Avançado |
| Evidências Requeridas (JSON) | Técnico | Avançado |

**Problema**: Campos JSON são confusos e intimidam usuários não-técnicos.

---

## Solução Proposta

### Formulário em Duas Etapas

```text
┌─────────────────────────────────────────────────────────────────┐
│                    FORMULÁRIO SIMPLIFICADO                      │
│                     (Modo Padrão - 4 campos)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Título *                                                │   │
│  │  [Orçamento Mensal________________________]              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Descrição                                               │   │
│  │  [Acompanhamento do orçamento do setor_____]             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────┐  ┌────────────────────────────┐    │
│  │  Periodicidade *       │  │  Responsável               │    │
│  │  [Mensal          ▼]   │  │  [João Silva         ▼]    │    │
│  └────────────────────────┘  └────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ▼ Configurações avançadas (opcional)                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                           [Cancelar]  [Criar Card]              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│               CONFIGURAÇÕES AVANÇADAS (Colapsado)               │
│                    (Expandido ao clicar)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────┐  ┌────────────────────────────┐    │
│  │  Backup                │  │  Dias para Risco           │    │
│  │  [Maria Santos    ▼]   │  │  [3                    ]   │    │
│  └────────────────────────┘  └────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Itens do Checklist                                      │   │
│  │  [+ Adicionar item]                                      │   │
│  │  ☐ Verificar valores                          [🗑️]       │   │
│  │  ☐ Conferir aprovações                        [🗑️]       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mudanças Principais

### 1. Campos Essenciais (Sempre Visíveis)

| Campo | Comportamento |
|-------|---------------|
| **Título** | Input simples, obrigatório |
| **Descrição** | Textarea, opcional |
| **Periodicidade** | Select com opções amigáveis |
| **Responsável** | Select de usuários |

### 2. Campos Avançados (Colapsados por Padrão)

| Campo | Comportamento |
|-------|---------------|
| **Backup** | Select de usuários |
| **Dias para Risco** | Input numérico (default: 3) |
| **Checklist** | UI amigável para adicionar itens |

### 3. Campos Removidos do Formulário

| Campo | Decisão |
|-------|---------|
| `manual_fields_schema_json` | Usar defaults do banco |
| `due_rule_json` | Usar defaults do banco |
| `required_evidences_json` | Usar defaults do banco |

Estes campos continuam existindo no banco e podem ser configurados via Admin para cards específicos.

---

## Arquivo a Modificar

### `src/components/governanca-ec/admin/ECCardForm.tsx`

**Alterações:**
1. Adicionar componente `Collapsible` para seção avançada
2. Remover campos JSON do formulário básico
3. Converter checklist de JSON para UI amigável
4. Simplificar validação Zod
5. Adicionar textos de ajuda mais claros

---

## Novo Schema do Formulário

```typescript
const formSchema = z.object({
  area_id: z.string().min(1, 'Área é obrigatória'),
  title: z.string().min(1, 'Título é obrigatório').max(100),
  description: z.string().max(500).optional(),
  periodicity_type: z.string().min(1, 'Periodicidade é obrigatória'),
  responsible_id: z.string().optional(),
  // Campos avançados (com defaults)
  backup_id: z.string().optional(),
  risk_days_threshold: z.coerce.number().min(1).max(30).default(3),
  checklistItems: z.array(z.object({
    text: z.string(),
    required: z.boolean().default(false)
  })).optional(),
});
```

---

## Interface do Checklist Amigável

Em vez de JSON, o usuário verá:

```text
┌─────────────────────────────────────────────────────────────┐
│  Itens do Checklist (opcional)                              │
│  Defina etapas que devem ser verificadas                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [+ Adicionar item de checklist]                            │
│                                                             │
│  1. [Verificar valores no sistema_______] [Obrigatório ☑️] 🗑️│
│  2. [Conferir aprovações________________] [Obrigatório ☐] 🗑️│
│  3. [Anexar comprovante_________________] [Obrigatório ☑️] 🗑️│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Conversão automática para JSON ao salvar:**
```json
[
  {"id": "1", "text": "Verificar valores no sistema", "required": true},
  {"id": "2", "text": "Conferir aprovações", "required": false},
  {"id": "3", "text": "Anexar comprovante", "required": true}
]
```

---

## Periodicidade com Labels Amigáveis

```typescript
const periodicityOptions = [
  { value: 'daily', label: 'Diário', description: 'Todo dia' },
  { value: 'weekly', label: 'Semanal', description: 'Uma vez por semana' },
  { value: 'biweekly', label: 'Quinzenal', description: 'A cada 15 dias' },
  { value: 'monthly', label: 'Mensal', description: 'Uma vez por mês' },
  { value: 'quarterly', label: 'Trimestral', description: 'A cada 3 meses' },
  { value: 'semiannual', label: 'Semestral', description: 'A cada 6 meses' },
  { value: 'annual', label: 'Anual', description: 'Uma vez por ano' },
  { value: 'manual_trigger', label: 'Sob demanda', description: 'Quando necessário' },
];
```

---

## Resumo da Implementação

| Ação | Descrição |
|------|-----------|
| Simplificar formulário | Mostrar apenas 4 campos essenciais |
| Adicionar Collapsible | Esconder campos avançados |
| UI para checklist | Substituir JSON por interface visual |
| Remover campos JSON | Usar defaults do banco |
| Textos de ajuda | Adicionar descrições claras |

---

## Seção Técnica

### Componentes Utilizados

- `Collapsible` do Radix UI (já instalado)
- Estado para gerenciar itens do checklist dinamicamente
- Conversão de array para JSON no submit

### Lógica de Submissão

```typescript
const handleSubmit = async (data: FormData) => {
  // Converter checklist items para JSON
  const checklistJson = data.checklistItems?.map((item, index) => ({
    id: `item-${index + 1}`,
    text: item.text,
    required: item.required
  })) || [];

  const payload = {
    area_id: data.area_id,
    title: data.title,
    description: data.description,
    periodicity_type: data.periodicity_type,
    responsible_id: data.responsible_id || null,
    backup_id: data.backup_id || null,
    risk_days_threshold: data.risk_days_threshold,
    checklist_template_json: checklistJson,
    // Usar defaults do banco para os demais campos JSONB
    manual_fields_schema_json: [],
    due_rule_json: {},
    required_evidences_json: [],
  };
  
  // Salvar...
};
```

### Compatibilidade

- Cards existentes continuam funcionando
- Edição preserva dados existentes dos campos avançados
- Admin ainda pode editar JSONs diretamente se necessário (via painel Admin)
