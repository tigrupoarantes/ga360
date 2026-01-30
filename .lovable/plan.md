

# Plano: Campo Centro de Custo nas Áreas Organizacionais

## Visão Geral

Adicionar um campo "Centro de Custo" nas áreas organizacionais para permitir integração com os ERPs do Grupo Arantes, possibilitando amarrar funcionários aos centros de custo correspondentes.

---

## Mudanças no Banco de Dados

### Tabela `areas` - Adicionar coluna

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| `cost_center` | `text` | Não | Código do centro de custo no ERP |

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| **Migração SQL** | Adicionar coluna `cost_center` na tabela `areas` |
| `src/components/admin/AreaFormDialog.tsx` | Adicionar campo Centro de Custo no formulário |
| `src/components/admin/AreaTreeView.tsx` | Exibir o centro de custo na árvore (quando preenchido) |
| `src/pages/AdminOrganization.tsx` | Atualizar interface Area para incluir `cost_center` |

---

## Detalhes da Implementação

### 1. Formulário de Área Atualizado

```text
┌─────────────────────────────────────────────────────────────┐
│  Nova Área / Editar Área                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Nome da Área *                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Comercial                                             │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  Centro de Custo                                            │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 1001                                                  │ │
│  └───────────────────────────────────────────────────────┘ │
│  Código conforme cadastrado no ERP                         │
│                                                             │
│  Área Superior (opcional)                                   │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Nenhuma (área raiz)                               ▼ │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│             [Cancelar]  [Criar área]                       │
└─────────────────────────────────────────────────────────────┘
```

### 2. Visualização na Árvore de Áreas

As áreas com centro de custo serão exibidas com o código entre parênteses:

```text
📁 Comercial (CC: 1001)
   📁 Vendas (CC: 1002)
      📁 Vendas Externas (CC: 1003)
   📁 Marketing
📁 Financeiro (CC: 2001)
   📁 Contabilidade (CC: 2002)
```

---

## Vinculação de Funcionários

A vinculação de funcionários ao centro de custo será feita **indiretamente**:

1. O funcionário está vinculado a uma **área** (via `area_id` no profile ou `department` no external_employees)
2. A **área** possui o **centro de custo**
3. Assim, ao consultar o funcionário, podemos obter o centro de custo através da área

### Fluxo de Relacionamento

```text
┌───────────────────┐     ┌──────────────────┐     ┌───────────────┐
│    Funcionário    │────▶│      Área        │────▶│ Centro Custo  │
│  (profile.area_id)│     │   (areas.id)     │     │(areas.cost_   │
│                   │     │                  │     │   center)     │
└───────────────────┘     └──────────────────┘     └───────────────┘
```

---

## Migração SQL

```sql
-- Adicionar coluna de centro de custo na tabela areas
ALTER TABLE areas 
ADD COLUMN cost_center text;

-- Índice para consultas rápidas por centro de custo
CREATE INDEX idx_areas_cost_center ON areas(cost_center) 
WHERE cost_center IS NOT NULL;

-- Comentário para documentação
COMMENT ON COLUMN areas.cost_center IS 
  'Código do centro de custo conforme ERP';
```

---

## Fluxo de Uso

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   [Admin] Acessa /admin/estrutura                                       │
│       │                                                                  │
│       ▼                                                                  │
│   [Admin] Cria/Edita uma área                                           │
│       │                                                                  │
│       ├─── Preenche Nome (obrigatório)                                  │
│       ├─── Preenche Centro de Custo (opcional)                          │
│       └─── Seleciona Área Superior (opcional)                           │
│       │                                                                  │
│       ▼                                                                  │
│   [Sistema] Salva a área com o centro de custo                          │
│       │                                                                  │
│       ▼                                                                  │
│   [Funcionário] É vinculado à área                                      │
│       │                                                                  │
│       ▼                                                                  │
│   [Relatórios/Integrações] Podem consultar centro de custo via área    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Considerações Futuras

Esta implementação abre possibilidades para:

1. **Relatórios por Centro de Custo** - Agrupar métricas por CC
2. **Sincronização ERP** - Validar CCs contra o cadastro do ERP
3. **Rateio de Custos** - Alocar despesas por centro de custo
4. **Filtros Avançados** - Filtrar funcionários/metas por CC

---

## Resumo das Entregas

| Funcionalidade | Local |
|----------------|-------|
| Campo Centro de Custo | Formulário de criação/edição de área |
| Visualização do CC | Árvore de áreas na estrutura organizacional |
| Vinculação com funcionário | Via relacionamento area_id → cost_center |

