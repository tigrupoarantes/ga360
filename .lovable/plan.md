

## Plano: Adicionar Modelos GPT-5 (incluindo 5.2)

Vou adicionar os modelos da série GPT-5 que estão faltando na lista.

---

## Modelos a Adicionar

| Modelo | Descrição |
|--------|-----------|
| `gpt-5.2` | Versão mais recente com raciocínio aprimorado |
| `gpt-5` | Modelo GPT-5 base |
| `gpt-5-mini` | Versão compacta do GPT-5 |
| `gpt-5-nano` | Versão ultra-leve do GPT-5 |

---

## Alteração no Código

Atualizar o array `CHAT_MODELS` em `src/components/settings/OpenAIConfigSection.tsx`:

```typescript
const CHAT_MODELS = [
  // Modelos GPT-5 (mais recentes)
  { value: 'gpt-5.2', label: 'GPT-5.2 (Último Lançamento)' },
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'gpt-5-mini', label: 'GPT-5 Mini' },
  { value: 'gpt-5-nano', label: 'GPT-5 Nano' },
  // Modelos GPT-4.1 / o-series
  { value: 'gpt-4.1', label: 'GPT-4.1 (Mais Avançado)' },
  // ... restante dos modelos existentes
];
```

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/settings/OpenAIConfigSection.tsx` | Adicionar modelos GPT-5, 5.2, 5-mini e 5-nano no início do array |

---

## Resultado Esperado

O dropdown mostrará o GPT-5.2 como primeira opção (mais recente), seguido pelos outros modelos da série 5 e depois os modelos existentes.

