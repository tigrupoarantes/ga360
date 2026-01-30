

## Plano: Adicionar Mais Modelos OpenAI/ChatGPT

Vou expandir a lista de modelos disponíveis na configuração de IA, incluindo os modelos mais recentes da OpenAI.

---

## Modelos a Adicionar

### Modelos de Chat (GPT)

| Modelo | Descrição | Uso Recomendado |
|--------|-----------|-----------------|
| `gpt-4.1` | Modelo mais recente e avançado | Tarefas complexas de raciocínio |
| `gpt-4.1-mini` | Versão compacta do GPT-4.1 | Equilíbrio custo/performance |
| `gpt-4.1-nano` | Versão ultra-leve | Alto volume, tarefas simples |
| `o3` | Modelo de raciocínio avançado | Problemas complexos, análise profunda |
| `o3-mini` | Raciocínio otimizado | Bom custo-benefício para raciocínio |
| `o4-mini` | Último modelo de raciocínio | Melhor performance em análise |
| `gpt-4o` | Modelo omni atual | Multimodal (texto + imagem) |
| `gpt-4o-mini` | Versão econômica do 4o | Uso geral econômico |
| `gpt-4-turbo` | GPT-4 otimizado | Contexto longo |
| `gpt-3.5-turbo` | Modelo legado | Tarefas simples, muito econômico |

### Modelos de Transcrição

| Modelo | Descrição |
|--------|-----------|
| `whisper-1` | Modelo padrão de transcrição |
| `gpt-4o-transcribe` | Transcrição via GPT-4o (mais preciso) |
| `gpt-4o-mini-transcribe` | Transcrição econômica |

---

## Alteração no Código

Atualizar o array `CHAT_MODELS` no arquivo `src/components/settings/OpenAIConfigSection.tsx`:

```typescript
const CHAT_MODELS = [
  // Modelos mais recentes (GPT-4.1 / o-series)
  { value: 'gpt-4.1', label: 'GPT-4.1 (Mais Avançado)' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano (Ultra-leve)' },
  { value: 'o4-mini', label: 'O4 Mini (Raciocínio)' },
  { value: 'o3', label: 'O3 (Raciocínio Avançado)' },
  { value: 'o3-mini', label: 'O3 Mini (Raciocínio Econômico)' },
  // Modelos GPT-4o
  { value: 'gpt-4o', label: 'GPT-4o (Recomendado)' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Econômico)' },
  // Modelos legados
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Legado)' },
];

const TRANSCRIPTION_MODELS = [
  { value: 'whisper-1', label: 'Whisper-1 (Padrão)' },
  { value: 'gpt-4o-transcribe', label: 'GPT-4o Transcribe (Mais Preciso)' },
  { value: 'gpt-4o-mini-transcribe', label: 'GPT-4o Mini Transcribe' },
];
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/settings/OpenAIConfigSection.tsx` | Expandir arrays `CHAT_MODELS` e `TRANSCRIPTION_MODELS` |

---

## Resultado Esperado

O dropdown de modelos mostrará todos os modelos disponíveis organizados por categoria, permitindo escolher desde os mais avançados (GPT-4.1, O3/O4) até os mais econômicos (GPT-3.5-turbo).

