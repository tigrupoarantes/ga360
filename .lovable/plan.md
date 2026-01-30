

## Plano: Configuração de API Key OpenAI nas Configurações Gerais

Vou criar uma seção nas Configurações Gerais para você adicionar sua API Key da OpenAI e migrar as edge functions para usar diretamente a OpenAI ao invés do Lovable AI.

---

## Visão Geral

| Item | Descrição |
|------|-----------|
| **Objetivo** | Permitir configurar API Key da OpenAI via interface |
| **Local** | Aba "Geral" em Admin > Configurações |
| **Armazenamento** | Tabela `system_settings` com key `openai_config` |
| **Impacto** | 4 edge functions serão atualizadas |

---

## O Que Será Criado

### 1. Novo Componente de Configuração
- `OpenAIConfigSection.tsx` - Formulário para configurar a integração OpenAI
- Campo para API Key (com máscara de senha)
- Seletor de modelo padrão (gpt-4o, gpt-4-turbo, gpt-3.5-turbo)
- Switch para habilitar/desabilitar a integração
- Botão para testar a conexão

### 2. Edge Function de Teste
- `test-openai-connection` - Valida se a API Key está funcionando

### 3. Atualização das Edge Functions de IA
As seguintes funções serão atualizadas para ler a config da OpenAI:
- `generate-report` - Relatórios via assistente IA
- `generate-ata` - Geração de ATAs de reunião
- `transcribe-meeting` - Transcrição de áudio (Whisper)
- `generate-stock-audit-report` - Relatório de auditoria

---

## Interface Visual

```text
┌─────────────────────────────────────────────────────────┐
│ 🤖 Integração OpenAI                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ [✓] Habilitar OpenAI                                    │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ API Key OpenAI *                                    │ │
│ │ [sk-••••••••••••••••••••••••••••••••••••••••••••] │ │
│ │ Obtenha sua API key em platform.openai.com         │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Modelo Padrão                                       │ │
│ │ [gpt-4o                                  ▼]        │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Modelo para Transcrição                             │ │
│ │ [whisper-1                               ▼]        │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [🔌 Testar Conexão]                                     │
│                                                         │
│ ⚠️ A API Key será armazenada de forma segura e usada   │
│    apenas nas funções de IA do sistema.                 │
└─────────────────────────────────────────────────────────┘
```

---

## Seção Técnica

### Estrutura de Dados (system_settings)

```json
{
  "key": "openai_config",
  "value": {
    "enabled": true,
    "api_key": "sk-...",
    "default_model": "gpt-4o",
    "transcription_model": "whisper-1"
  }
}
```

### Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/settings/OpenAIConfigSection.tsx` | Criar | Componente de configuração |
| `src/pages/AdminSettings.tsx` | Modificar | Adicionar aba IA ou incluir na aba Geral |
| `supabase/functions/test-openai-connection/index.ts` | Criar | Testar conexão com OpenAI |
| `supabase/functions/generate-report/index.ts` | Modificar | Usar OpenAI ao invés de Lovable AI |
| `supabase/functions/generate-ata/index.ts` | Modificar | Usar OpenAI ao invés de Lovable AI |
| `supabase/functions/transcribe-meeting/index.ts` | Modificar | Usar OpenAI ao invés de Lovable AI |
| `supabase/functions/generate-stock-audit-report/index.ts` | Modificar | Usar OpenAI ao invés de Lovable AI |

### Lógica das Edge Functions

```typescript
// Prioridade de API Key:
// 1. Buscar openai_config da tabela system_settings
// 2. Se não configurado, usar OPENAI_API_KEY das env vars (fallback)
// 3. Se nenhum, retornar erro informativo

const { data: settings } = await supabase
  .from('system_settings')
  .select('value')
  .eq('key', 'openai_config')
  .single();

const openaiConfig = settings?.value;
const apiKey = openaiConfig?.api_key || Deno.env.get('OPENAI_API_KEY');
const model = openaiConfig?.default_model || 'gpt-4o';
```

### Endpoints OpenAI

| Função | Endpoint | Modelo |
|--------|----------|--------|
| Chat/Completions | `https://api.openai.com/v1/chat/completions` | gpt-4o |
| Transcrição | `https://api.openai.com/v1/audio/transcriptions` | whisper-1 |

---

## Segurança

- API Key armazenada na tabela `system_settings` com RLS ativo
- Apenas usuários com role `super_admin` podem acessar/modificar
- Campo exibido como password no frontend
- Validação da key antes de salvar (via teste de conexão)

