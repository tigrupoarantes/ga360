# QLP Qualitativo — Plano de Implementação por Fases

## Objetivo
Implementar indicadores qualitativos no QLP com baixo risco de regressão e entregas incrementais.

## Fase 1 — Base de dados no contexto do drill-down (Concluída)
- Reuso do contexto atual do QLP (Total, Empresa, Unidade).
- Normalização de gênero (`Masculino`, `Feminino`, `Não informado`).
- Cálculo de idade por `age` com fallback para `birth_date`.
- Agrupamentos para cargos por gênero.
- Indicadores de PCD e afastamento por metadados.

## Fase 2 — Visualização qualitativa no card QLP (Concluída)
- Gráfico donut: **Homem x Mulher**.
- Gráfico barras: **Ativos por faixa etária** (`18-20`, `21-30`, `31-40`, `41-50`, `51-60`, `61+`).
- Gráfico barras agrupadas: **Cargos por gênero (Top 10)**.
- KPIs: **Funcionários PCD** e **Funcionários afastados**.

## Fase 3 — Consolidação de dados de afastamento (Pendente)
- Hoje não há campo explícito padrão de afastamento em `external_employees`.
- Contagem atual usa chaves conhecidas em `metadata` (quando presentes).
- Próximo passo: definir campo canônico (`is_on_leave` ou equivalente) e padronizar origem.

## Fase 4 — Refino de UX e performance (Pendente)
- Ajustar densidade visual e responsividade dos gráficos.
- Definir regra para “Top N cargos” por contexto (com botão de expansão, se necessário).
- Revisar tooltips e labels para melhor leitura executiva.

## Critérios de avanço
- Cada fase só avança com build válido.
- Ajustes de modelo de dados (Fase 3) devem entrar em alteração separada.
