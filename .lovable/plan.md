

## Otimização da Edge Function sync-sales-items

### Problema Identificado
O erro **WORKER_LIMIT** ocorre porque a função atual processa cada item individualmente:
- 1 query por item para verificar existência
- 1 query por item para insert/update
- Com 1000 itens = 2000+ queries = timeout e esgotamento de recursos

### Solução: Processamento em Batch

Vou fornecer código otimizado que reduz drasticamente o número de queries usando:

1. **Upsert em massa** - Processa até 500 registros por query
2. **Cache de relacionamentos** - Carrega clientes/produtos/vendedores uma vez
3. **Operações paralelas** - Processa tabelas auxiliares simultaneamente

### Código Otimizado para sync-sales-items

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

const BATCH_SIZE = 200; // Processa 200 itens por vez

interface SalesItem {
  external_id: string;
  order_date: string;
  invoice_date?: string;
  order_number: string;
  order_type?: string;
  customer_code: string;
  customer_name?: string;
  customer_segment?: string;
  customer_network?: string;
  customer_address?: string;
  customer_neighborhood?: string;
  customer_city?: string;
  customer_state?: string;
  customer_cnpj?: string;
  product_code: string;
  product_name?: string;
  product_line?: string;
  product_brand?: string;
  product_manufacturer?: string;
  seller_code?: string;
  seller_name?: string;
  supervisor_code?: string;
  supervisor_name?: string;
  quantity: number;
  unit_price?: number;
  total_value: number;
  cost_value?: number;
  margin_value?: number;
  margin_percent?: number;
}

interface SyncRequest {
  company_external_id: string;
  items: SalesItem[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`[sync-sales-items] Starting at ${new Date().toISOString()}`);

  try {
    // Validate API Key
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = Deno.env.get('SYNC_API_KEY');

    if (!apiKey || apiKey !== expectedApiKey) {
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SyncRequest = await req.json();
    const items = body.items || [];
    
    console.log(`[sync-sales-items] Received ${items.length} items for ${body.company_external_id}`);

    if (!body.company_external_id || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing company_external_id or items' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('external_id', body.company_external_id)
      .maybeSingle();

    if (companyError || !company) {
      return new Response(
        JSON.stringify({ error: `Company not found: ${body.company_external_id}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const companyId = company.id;

    // ========== FASE 1: Extrair dados únicos ==========
    const uniqueCustomers = new Map<string, any>();
    const uniqueProducts = new Map<string, any>();
    const uniqueSellers = new Map<string, any>();

    for (const item of items) {
      // Clientes
      if (item.customer_code && !uniqueCustomers.has(item.customer_code)) {
        uniqueCustomers.set(item.customer_code, {
          company_id: companyId,
          external_id: item.customer_code,
          code: item.customer_code,
          name: item.customer_name || item.customer_code,
          segment: item.customer_segment,
          network: item.customer_network,
          address: item.customer_address,
          neighborhood: item.customer_neighborhood,
          city: item.customer_city,
          state: item.customer_state,
          cnpj: item.customer_cnpj,
        });
      }

      // Produtos
      if (item.product_code && !uniqueProducts.has(item.product_code)) {
        uniqueProducts.set(item.product_code, {
          company_id: companyId,
          external_id: item.product_code,
          code: item.product_code,
          name: item.product_name || item.product_code,
          line: item.product_line,
          brand: item.product_brand,
          manufacturer: item.product_manufacturer,
        });
      }

      // Vendedores
      if (item.seller_code && !uniqueSellers.has(item.seller_code)) {
        uniqueSellers.set(item.seller_code, {
          company_id: companyId,
          external_id: item.seller_code,
          code: item.seller_code,
          name: item.seller_name || item.seller_code,
          supervisor_code: item.supervisor_code,
          supervisor_name: item.supervisor_name,
        });
      }
    }

    console.log(`[sync-sales-items] Unique: ${uniqueCustomers.size} customers, ${uniqueProducts.size} products, ${uniqueSellers.size} sellers`);

    // ========== FASE 2: Upsert em batch (paralelo) ==========
    const [customersResult, productsResult, sellersResult] = await Promise.all([
      // Upsert customers
      supabase.from('sales_customers').upsert(
        Array.from(uniqueCustomers.values()),
        { onConflict: 'company_id,external_id', ignoreDuplicates: false }
      ),
      // Upsert products
      supabase.from('sales_products').upsert(
        Array.from(uniqueProducts.values()),
        { onConflict: 'company_id,external_id', ignoreDuplicates: false }
      ),
      // Upsert sellers
      supabase.from('sales_team').upsert(
        Array.from(uniqueSellers.values()),
        { onConflict: 'company_id,external_id', ignoreDuplicates: false }
      ),
    ]);

    if (customersResult.error) console.error('Customers upsert error:', customersResult.error);
    if (productsResult.error) console.error('Products upsert error:', productsResult.error);
    if (sellersResult.error) console.error('Sellers upsert error:', sellersResult.error);

    // ========== FASE 3: Carregar IDs dos relacionamentos ==========
    const [customersData, productsData, sellersData] = await Promise.all([
      supabase.from('sales_customers').select('id, external_id').eq('company_id', companyId),
      supabase.from('sales_products').select('id, external_id').eq('company_id', companyId),
      supabase.from('sales_team').select('id, external_id').eq('company_id', companyId),
    ]);

    const customerMap = new Map(customersData.data?.map(c => [c.external_id, c.id]) || []);
    const productMap = new Map(productsData.data?.map(p => [p.external_id, p.id]) || []);
    const sellerMap = new Map(sellersData.data?.map(s => [s.external_id, s.id]) || []);

    // ========== FASE 4: Preparar e upsert sales_items em batches ==========
    const salesItemsToUpsert = items.map(item => ({
      company_id: companyId,
      external_id: item.external_id,
      order_date: item.order_date,
      invoice_date: item.invoice_date,
      order_number: item.order_number,
      order_type: item.order_type,
      customer_id: customerMap.get(item.customer_code) || null,
      product_id: productMap.get(item.product_code) || null,
      seller_id: sellerMap.get(item.seller_code) || null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_value: item.total_value,
      cost_value: item.cost_value,
      margin_value: item.margin_value,
      margin_percent: item.margin_percent,
      synced_at: new Date().toISOString(),
    }));

    let totalUpserted = 0;
    let totalErrors = 0;

    // Processar em batches de BATCH_SIZE
    for (let i = 0; i < salesItemsToUpsert.length; i += BATCH_SIZE) {
      const batch = salesItemsToUpsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('sales_items')
        .upsert(batch, { onConflict: 'company_id,external_id', ignoreDuplicates: false });

      if (error) {
        console.error(`Batch ${i / BATCH_SIZE + 1} error:`, error);
        totalErrors += batch.length;
      } else {
        totalUpserted += batch.length;
      }
    }

    const duration = Date.now() - startTime;

    const result = {
      success: true,
      received: items.length,
      upserted: totalUpserted,
      errors: totalErrors,
      duration_ms: duration,
      customers_synced: uniqueCustomers.size,
      products_synced: uniqueProducts.size,
      sellers_synced: uniqueSellers.size,
    };

    console.log(`[sync-sales-items] Completed:`, result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-sales-items] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### Principais Otimizações

| Antes | Depois |
|-------|--------|
| 1 query por item | Batch de 200 itens por query |
| Loop síncrono | Operações paralelas (Promise.all) |
| Insert/Update separados | Upsert com ON CONFLICT |
| ~2000 queries para 1000 itens | ~15-20 queries para 1000 itens |

### Como Aplicar

1. **No Supabase externo**, substitua o código da função `sync-sales-items` pelo código acima
2. **Faça deploy** com: `supabase functions deploy sync-sales-items --no-verify-jwt`
3. **Teste no N8N** com os mesmos dados

### Pré-requisitos

Certifique-se que as tabelas `sales_customers`, `sales_products`, `sales_team` e `sales_items` tenham constraints UNIQUE em `(company_id, external_id)` para o upsert funcionar.
