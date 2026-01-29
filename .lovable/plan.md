

# Plano: Adicionar Download de Template + Melhorar Auto-Detecção

## Objetivo

Adicionar botão para baixar template padrão e expandir os padrões de detecção automática de colunas do ERP.

---

## Template CSV Atualizado

Ordem das colunas ajustada (UNIDADE antes de QUANTIDADE):

| Coluna | Obrigatório | Exemplo |
|--------|-------------|---------|
| CODIGO | Sim | SKU001 |
| DESCRICAO | Não | Produto Exemplo |
| UNIDADE | Não | UN |
| QUANTIDADE | Sim | 100 |

**Conteúdo do arquivo gerado:**
```csv
CODIGO;DESCRICAO;UNIDADE;QUANTIDADE
SKU001;Produto Exemplo 1;UN;100
SKU002;Produto Exemplo 2;CX;50
```

---

## Mudanças no BaseUploader.tsx

### 1. Nova Seção de Template

Adicionar card acima da área de upload:

```text
┌─────────────────────────────────────────────────────────┐
│  💡 Precisa de um modelo?                               │
│                                                         │
│  [📥 Baixar Template CSV]                               │
│                                                         │
│  "Preencha com os dados do seu ERP e importe aqui"     │
└─────────────────────────────────────────────────────────┘
```

### 2. Função downloadTemplate

```typescript
const downloadTemplate = () => {
  const csvContent = [
    "CODIGO;DESCRICAO;UNIDADE;QUANTIDADE",
    "SKU001;Produto Exemplo 1;UN;100",
    "SKU002;Produto Exemplo 2;CX;50",
  ].join("\n");
  
  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "template_auditoria_estoque.csv";
  link.click();
  URL.revokeObjectURL(url);
};
```

### 3. Padrões de Detecção Expandidos

| Campo | Padrões a Detectar |
|-------|-------------------|
| `sku_code` | codigo, código, cod, sku, produto, item, codprod, cod_prod, code, id_produto |
| `system_qty` | atual, quantidade, qtd, saldo, estoque, qty, qtd_atual, qtde, stock, inventario |
| `sku_description` | descricao, descrição, nome, desc, description, nome_produto, name |
| `uom` | un, unidade, um, uom, medida, unit |
| `location` | local, localizacao, localização, endereco, endereço, location, posicao, end |

---

## Arquivo a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/stock-audit/steps/BaseUploader.tsx` | Adicionar botão template + expandir padrões de detecção |

