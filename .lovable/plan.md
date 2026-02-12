

# Inativacao automatica de funcionarios ausentes na sincronizacao

## Problema
O Gestao de Ativos possui 865 registros, mas o GA360 tem 892. Os 27 funcionarios extras no GA360 provavelmente foram desligados ou removidos do sistema de origem, mas continuam marcados como ativos porque a sync atual so insere e atualiza -- nunca inativa.

## Solucao

Adicionar uma **terceira etapa** na Edge Function `sync-employees` que, apos processar todos os registros recebidos, identifica e inativa os funcionarios que existem no GA360 mas nao vieram no payload da sincronizacao.

## Fluxo atualizado

```text
Etapa 1: Inserir/Atualizar funcionarios recebidos (ja existe)
         |
Etapa 2: Resolver lider_direto_id (ja existe)
         |
Etapa 3: [NOVO] Inativar funcionarios ausentes
         - Buscar todos os ativos no GA360 para as empresas do payload
         - Comparar com os external_ids processados
         - Marcar como is_active = false os que nao vieram
```

## Logica de inativacao

A inativacao sera feita **por empresa** para evitar desativar funcionarios de empresas que nao participaram da sync atual. Exemplo:

- Se o payload trouxe funcionarios apenas da Chok Distribuidora e Broker, so compara contra essas duas empresas
- Funcionarios da G4 que nao vieram no payload nao sao afetados

Isso permite sincronizacoes parciais (uma empresa por vez) sem efeitos colaterais.

## Detalhes tecnicos

### Arquivo modificado
- `supabase/functions/sync-employees/index.ts`

### Alteracoes na Edge Function

Apos a segunda etapa (resolucao de lideres), adicionar:

1. Coletar os `company_id`s unicos que foram processados com sucesso
2. Para cada empresa, buscar todos os `external_employees` ativos com `source_system` igual ao da sync
3. Comparar os `external_id`s ativos no banco contra os que vieram no payload
4. Fazer UPDATE em lote: `is_active = false` para os que nao vieram
5. Registrar a quantidade de inativados nas estatisticas e no sync_log

### Campos adicionais na resposta

A resposta JSON passara a incluir:
- `deactivated`: numero total de funcionarios inativados
- `by_company[cnpj].deactivated`: inativados por empresa

### Protecao contra sync vazio

Se o payload vier com 0 funcionarios para uma empresa, a funcao **nao** inativara ninguem dessa empresa (protecao contra erros de integracao que enviam payload vazio acidentalmente).

## Resultado esperado

- Apos a proxima sincronizacao com os 865 registros do Gestao de Ativos, os 27 funcionarios extras serao automaticamente marcados como `is_active = false`
- A interface de funcionarios (que ja filtra por `is_active`) deixara de exibi-los por padrao
- O sync_log registrara quantos foram inativados para auditoria

