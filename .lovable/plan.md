
# Plano: Atualizar Frontend para Tabelas Normalizadas de Vendas

## Resumo

Atualizar todos os componentes de vendas para usar as novas tabelas `sales_items`, `sales_customers`, `sales_products` e `sales_team` em vez da tabela agregada `sales_daily`.

---

## Alteracoes Necessarias

### 1. SalesDashboard.tsx - Novos KPIs de Margem

**Alteracoes:**
- Trocar consulta de `sales_daily` para `sales_items`
- Adicionar 2 novos KPIs: **Margem Bruta R$** e **Margem Bruta %**
- Layout de 6 cards (3x2 em desktop)

**Novos campos calculados:**
| KPI | Calculo |
|-----|---------|
| Faturamento | SUM(sale_value) |
| Volume | SUM(quantity_sale) |
| Clientes Unicos | COUNT(DISTINCT customer_id) |
| Ticket Medio | Faturamento / Clientes Unicos |
| Margem Bruta R$ | SUM(gross_margin_value) |
| Margem Bruta % | (Margem R$ / Faturamento) * 100 |

---

### 2. SalesFilters.tsx - Novos Filtros Avancados

**Novos filtros a adicionar:**
- **Segmento** (customer_segment via sales_customers)
- **Rede** (customer_network via sales_customers)
- **Linha de Produto** (line via sales_products)
- **Fabricante** (manufacturer via sales_products)
- **Supervisor** (supervisor_code via sales_team)

**Alteracoes na props interface:**
```typescript
interface SalesFiltersProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  selectedDistributor: string;
  onDistributorChange: (distributorId: string) => void;
  // Novos filtros
  selectedSegment: string;
  onSegmentChange: (segment: string) => void;
  selectedNetwork: string;
  onNetworkChange: (network: string) => void;
  selectedLine: string;
  onLineChange: (line: string) => void;
  selectedManufacturer: string;
  onManufacturerChange: (manufacturer: string) => void;
  selectedSupervisor: string;
  onSupervisorChange: (supervisor: string) => void;
}
```

---

### 3. SalesTable.tsx - Colunas Detalhadas

**Alteracoes:**
- Trocar consulta de `sales_daily` para `sales_items` com JOINs
- Adicionar colunas: Cliente, Segmento, Vendedor, Margem %
- Atualizar busca para incluir novos campos
- Aplicar todos os filtros vindos do SalesFilters

**Novas colunas:**
| Coluna Atual | Nova Coluna |
|--------------|-------------|
| Data | Data Pedido |
| Distribuidora | (manter) |
| Produto | Produto + Fabricante |
| Categoria | Linha/Categoria |
| Qtd | Quantidade |
| Valor | Valor Venda |
| Clientes | Cliente (nome) |
| - | Vendedor |
| - | Margem % |

---

### 4. SalesChart.tsx - Graficos de Margem

**Alteracoes:**
- Trocar consulta de `sales_daily` para `sales_items`
- Adicionar grafico de **Margem por Categoria/Linha**
- Adicionar grafico de **Vendas por Segmento**
- Atualizar grafico de categorias para usar `product_line`

---

### 5. SellerPerformance.tsx - Hierarquia de Vendas

**Alteracoes:**
- Trocar consulta de `sales_sellers` para `sales_items` + `sales_team`
- Adicionar agrupamento por **Supervisor** e **Gerente**
- Adicionar coluna de **Margem Bruta** por vendedor
- Criar visualizacao hierarquica (Gerente > Supervisor > Vendedor)

---

## Interface de Filtros Atualizada

```text
┌────────────────────────────────────────────────────────────────┐
│ [Periodo v] [📅 Data] [Distribuidora v]                        │
│ [Segmento v] [Rede v] [Linha v] [Fabricante v] [Supervisor v]  │
└────────────────────────────────────────────────────────────────┘
```

---

## Secao Tecnica: Queries Supabase

### Query para KPIs (SalesDashboard):
```typescript
const { data } = await supabase
  .from('sales_items')
  .select('sale_value, quantity_sale, customer_id, gross_margin_value')
  .eq('company_id', selectedCompanyId)
  .gte('order_date', fromDate)
  .lte('order_date', toDate);

// Agregar no frontend:
const totalValue = data.reduce((sum, s) => sum + s.sale_value, 0);
const totalVolume = data.reduce((sum, s) => sum + s.quantity_sale, 0);
const uniqueCustomers = new Set(data.map(s => s.customer_id)).size;
const grossMargin = data.reduce((sum, s) => sum + s.gross_margin_value, 0);
```

### Query para Tabela (SalesTable):
```typescript
const { data } = await supabase
  .from('sales_items')
  .select(`
    id,
    order_date,
    order_number,
    sale_value,
    quantity_sale,
    gross_margin_percent,
    sales_customers!inner(external_id, name, segment, network),
    sales_products!inner(external_id, name, category, line, manufacturer),
    sales_team!inner(seller_code, seller_name, supervisor_name)
  `)
  .eq('company_id', selectedCompanyId)
  .gte('order_date', fromDate)
  .lte('order_date', toDate);
```

### Query para Filtros Dinamicos:
```typescript
// Segmentos unicos
const { data: segments } = await supabase
  .from('sales_customers')
  .select('segment')
  .eq('company_id', selectedCompanyId)
  .not('segment', 'is', null);

// Redes unicas
const { data: networks } = await supabase
  .from('sales_customers')
  .select('network')
  .eq('company_id', selectedCompanyId)
  .not('network', 'is', null);

// Linhas unicas
const { data: lines } = await supabase
  .from('sales_products')
  .select('line')
  .eq('company_id', selectedCompanyId)
  .not('line', 'is', null);
```

---

## Resumo dos Arquivos a Modificar

| Arquivo | Tipo de Alteracao |
|---------|-------------------|
| `src/components/sales/SalesDashboard.tsx` | Adicionar KPIs de margem, passar novos filtros |
| `src/components/sales/SalesFilters.tsx` | Adicionar 5 novos filtros (Segmento, Rede, Linha, Fabricante, Supervisor) |
| `src/components/sales/SalesTable.tsx` | Nova query com JOINs, novas colunas, aplicar filtros |
| `src/components/sales/SalesChart.tsx` | Nova query, graficos de margem e segmento |
| `src/components/sales/SellerPerformance.tsx` | Hierarquia vendas, margem por vendedor |

---

## Fluxo de Dados Atualizado

```text
┌──────────────────────────────────────────────────────────────────┐
│                         SalesDashboard                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Estado: dateRange, distributor, segment, network,          │  │
│  │         line, manufacturer, supervisor                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ SalesFilters (todos os filtros)                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│         ┌────────────────────┼────────────────────┐              │
│         ▼                    ▼                    ▼              │
│  ┌────────────┐       ┌────────────┐       ┌────────────┐        │
│  │ SalesChart │       │ SalesTable │       │ SellerPerf │        │
│  │ (graficos) │       │ (detalhes) │       │ (ranking)  │        │
│  └────────────┘       └────────────┘       └────────────┘        │
└──────────────────────────────────────────────────────────────────┘
```
