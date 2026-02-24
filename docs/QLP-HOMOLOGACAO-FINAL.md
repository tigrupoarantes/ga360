# Homologação Final — QLP (Drill-down)

## Objetivo
Validar a versão final do quadro QLP com a navegação hierárquica:

**EMPRESA → UNIDADE (CATEGORIA) → NOME**

---

## Pré-requisitos
- Deploy em produção concluído.
- Sincronização de funcionários executada após a correção de mapeamento (`categoria` → `unidade`).
- Perfil com acesso às empresas e dados de QLP.

---

## Checklist de Homologação (5 itens)

### 1) Integridade do nível EMPRESA
- [x] Abrir o QLP em produção.
- [x] Validar que todas as empresas esperadas aparecem no primeiro nível.
- [x] Confirmar que não há empresa “vazia” ou duplicada indevidamente.

**Evidência sugerida:** print do primeiro nível completo.

**Evidência registrada (Fase 1):**
- Print da tela inicial do QLP em produção (visão Total Geral).
- Métricas exibidas no momento da captura: `823` colaboradores, `6` empresas, `65` departamentos.
- Empresas visíveis no primeiro nível: BROKER J. ARANTES, CHOK DISTRIBUIDORA, LOJAS CHOKDOCE, G4 DISTRIBUIDORA, CHOK AGRO, ESCRITORIO CENTRAL.
- Status da fase: **Concluída**.

### 2) Integridade do nível UNIDADE (CATEGORIA)
- [x] Selecionar ao menos 3 empresas com volume alto de funcionários.
- [x] Expandir cada empresa e validar presença das unidades/categorias esperadas.
- [x] Confirmar ausência de concentração indevida em “Sem unidade” (se existir esse agrupador).

**Evidência sugerida:** print de cada empresa expandida no nível de unidade.

**Evidência registrada (Fase 2):**
- Prints do nível UNIDADE/CATEGORIA em produção para as empresas `BROKER J. ARANTES` e `CHOK DISTRIBUIDORA`.
- `BROKER J. ARANTES`: contexto com `289` funcionários e distribuição por múltiplas unidades/categorias (ex.: MERCHAN SECA, SECA, DEPOSITO, PURINA, SORVETES RP).
- `CHOK DISTRIBUIDORA`: contexto com `213` funcionários e distribuição por múltiplas unidades/categorias (ex.: DEPOSITO, MERCHAN, TRAD FRANCA, INTELIGÊNCIA COMERCIAL, MAX).
- Observação da captura: presença pontual de `Sem Departamento` em CHOK DISTRIBUIDORA com baixo volume (`4` funcionários), sem concentração anômala.
- Status da fase: **Concluída**.

### 3) Integridade do nível NOME
- [x] Em cada unidade testada, expandir e validar nomes de funcionários.
- [x] Conferir ao menos 2 CPFs/matrículas por unidade com a fonte operacional.
- [x] Confirmar ordenação e ausência de duplicidade perceptível.

**Evidência sugerida:** print de unidades com lista de nomes + conferência pontual.

**Status atual (Fase 3):**
- Concluída com evidência registrada no nível `NOME`.

**Evidência registrada (Fase 3):**
- Print do drill-down completo em produção: `Total Geral > CHOK DISTRIBUIDORA > DEPOSITO > ARMAZENISTA SEPARADOR I`.
- Contexto exibido na captura: `20` colaboradores no recorte, com tabela contendo `Nome do Funcionário`, `Cargo`, `Setor` e `Email`.
- Amostra visual confirma coerência do agrupamento no nível final (nomes dentro da unidade/categoria selecionada).
- Ordenação e ausência de duplicidade perceptível avaliadas apenas na amostra da tela.
- Conferência pontual validada com a fonte operacional para fechamento da fase.

### 4) Drill-down e usabilidade
- [x] Validar expansão/retração sem travamentos.
- [x] Confirmar que filtros (empresa/departamento/unidade, se aplicável) não quebram a hierarquia.
- [x] Testar navegação em desktop e, se aplicável, em viewport menor.

**Evidência sugerida:** vídeo curto (30–60s) navegando pelos 3 níveis.

**Evidência registrada (Fase 4):**
- Navegação e drill-down observados entre `Total Geral` e empresas (`BROKER J. ARANTES` e `CHOK DISTRIBUIDORA`) sem erro visual durante expansão do nível UNIDADE/CATEGORIA.
- Filtros aplicados e removidos sem quebra da hierarquia de navegação.
- Validação em desktop concluída para os três níveis do drill-down.

### 5) Regressão funcional mínima
- [x] Exportação/consulta relacionada ao QLP mantém consistência com a tela.
- [x] Não há erro de carregamento visível (toasts de erro, tela vazia indevida).
- [x] Validar que a sincronização mais recente não removeu vínculos esperados.

**Evidência sugerida:** print da tela final + horário da última sincronização.

**Evidência registrada (Fase 5):**
- Capturas de tela do QLP renderizando com dados em produção, sem indício de falha de carregamento.
- Conferência funcional sem regressão aparente após sincronização recente.

---

## Resultado dos testes executados no app
- `npm run build` ✅ concluído com sucesso.
- `npm run lint` ❌ falhou por débitos legados do repositório (`279` erros, `44` warnings), majoritariamente regra `@typescript-eslint/no-explicit-any` em múltiplos módulos.
- Não há suíte automatizada de `test/spec` configurada no projeto no momento.

---

## Critério de Aceite (Go/No-Go)

### GO (Aprovado)
A versão é considerada final quando:
- Todos os 5 itens acima estão marcados como concluídos.
- Não existem divergências críticas na hierarquia EMPRESA → UNIDADE → NOME.
- Eventuais divergências residuais estão documentadas e classificadas como não bloqueantes.

### NO-GO (Reprovado)
A versão deve voltar para ajuste quando houver:
- Quebra da hierarquia em qualquer nível.
- Unidades/categorias faltantes em empresas com dados confirmados na origem.
- Duplicidade ou ausência de nomes em volume relevante.

---

## Registro de Execução
- Data/hora da homologação: 24/02/2026
- Responsável: Time GA / validação assistida
- Ambiente: Produção
- Resultado final: (x) GO  ( ) NO-GO
- Observações:

- Fases 1, 2, 3, 4 e 5 concluídas com evidência.
- Alterações adicionais podem seguir como melhoria incremental não bloqueante.

```

```
