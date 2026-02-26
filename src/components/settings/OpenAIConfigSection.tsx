import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, Eye, EyeOff, Loader2, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/external-client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

interface OpenAIConfig {
  enabled: boolean;
  api_key: string;
  default_model: string;
  transcription_model: string;
  goal_provider: 'openai' | 'gemini';
  gemini_api_key: string;
  gemini_model: string;
}

const DEFAULT_CONFIG: OpenAIConfig = {
  enabled: false,
  api_key: '',
  default_model: 'gpt-4o',
  transcription_model: 'whisper-1',
  goal_provider: 'openai',
  gemini_api_key: '',
  gemini_model: 'gemini-2.0-flash-lite',
};

const CHAT_MODELS = [
  // Modelos GPT-4o (Recomendados)
  { value: 'gpt-4o', label: 'GPT-4o (Mais Rápido e Inteligente)' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Custo-Benefício)' },
  // Modelos o1 (Raciocínio Avançado)
  { value: 'o1-preview', label: 'o1 Preview (Raciocínio Complexo)' },
  { value: 'o1-mini', label: 'o1 Mini (Raciocínio Rápido)' },
  // Modelos legados
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Legado)' },
];

const TRANSCRIPTION_MODELS = [
  { value: 'whisper-1', label: 'Whisper-1 (Padrão)' },
];

const GEMINI_MODELS = [
  { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite (Mais Econômico)' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Balanceado)' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Compatível)' },
];

export function OpenAIConfigSection() {
  const [config, setConfig] = useState<OpenAIConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'openai_config')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading OpenAI config:', error);
        return;
      }

      if (data?.value) {
        setConfig({
          ...DEFAULT_CONFIG,
          ...(data.value as Partial<OpenAIConfig>),
        });
      }
    } catch (error) {
      console.error('Error loading OpenAI config:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (config.enabled && !config.api_key && !config.gemini_api_key) {
      toast.error('Informe ao menos uma API Key (OpenAI ou Gemini) para habilitar IA');
      return;
    }

    if (config.goal_provider === 'openai' && config.enabled && !config.api_key) {
      toast.error('API Key OpenAI é obrigatória quando o copiloto está em OpenAI');
      return;
    }

    if (config.goal_provider === 'gemini' && config.enabled && !config.gemini_api_key) {
      toast.error('API Key Gemini é obrigatória quando o copiloto está em Gemini');
      return;
    }

    setSaving(true);
    try {
      // Check if record exists
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('key', 'openai_config')
        .single();

      const configValue = config as unknown as Json;

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('system_settings')
          .update({
            value: configValue,
            updated_at: new Date().toISOString(),
          })
          .eq('key', 'openai_config');

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('system_settings')
          .insert([{
            key: 'openai_config',
            value: configValue,
          }]);

        if (error) throw error;
      }

      toast.success('Configuração de IA salva com sucesso');
    } catch (error) {
      console.error('Error saving OpenAI config:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    const provider = config.goal_provider;
    const selectedApiKey = provider === 'gemini' ? config.gemini_api_key : config.api_key;

    if (!selectedApiKey) {
      toast.error('Insira a API Key do provedor selecionado antes de testar');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-openai-connection', {
        body: {
          provider,
          apiKey: selectedApiKey,
          model: provider === 'gemini' ? config.gemini_model : config.default_model,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setTestResult('success');
        toast.success(`Conexão com ${provider === 'gemini' ? 'Gemini' : 'OpenAI'} estabelecida com sucesso!`);
      } else {
        setTestResult('error');
        toast.error(data?.error || 'Falha ao conectar com o provedor selecionado');
      }
    } catch (error) {
      console.error('Error testing OpenAI connection:', error);
      setTestResult('error');
      toast.error('Erro ao testar conexão com IA');
    } finally {
      setTesting(false);
    }
  };

  const maskApiKey = (key: string) => {
    if (!key) return '';
    if (key.length <= 10) return '•'.repeat(key.length);
    return key.substring(0, 7) + '•'.repeat(Math.min(key.length - 10, 30)) + key.substring(key.length - 3);
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Integração de IA</h3>
          <p className="text-sm text-muted-foreground">
            Configure OpenAI e Gemini e escolha o provedor do copiloto de metas
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="space-y-0.5">
          <Label htmlFor="openai-enabled" className="font-medium">Habilitar OpenAI</Label>
          <p className="text-xs text-muted-foreground">
            Ative para usar recursos de IA no sistema
          </p>
        </div>
        <Switch
          id="openai-enabled"
          checked={config.enabled}
          onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
        />
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="goal-provider">Provedor do Copiloto de Metas</Label>
          <Select
            value={config.goal_provider}
            onValueChange={(value) => setConfig({ ...config, goal_provider: value as OpenAIConfig['goal_provider'] })}
            disabled={!config.enabled}
          >
            <SelectTrigger id="goal-provider">
              <SelectValue placeholder="Selecione um provedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="gemini">Gemini (Google)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Define qual IA será usada no copiloto da tela de metas
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="api-key">
            API Key OpenAI <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              id="api-key"
              type={showApiKey ? 'text' : 'password'}
              value={showApiKey ? config.api_key : maskApiKey(config.api_key)}
              onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
              placeholder="sk-..."
              className="pr-10"
              disabled={!config.enabled}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowApiKey(!showApiKey)}
              disabled={!config.enabled}
            >
              {showApiKey ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            Obtenha sua API key em{' '}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              platform.openai.com
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gemini-api-key">
            API Key Gemini {config.goal_provider === 'gemini' && <span className="text-destructive">*</span>}
          </Label>
          <div className="relative">
            <Input
              id="gemini-api-key"
              type={showApiKey ? 'text' : 'password'}
              value={showApiKey ? config.gemini_api_key : maskApiKey(config.gemini_api_key)}
              onChange={(e) => setConfig({ ...config, gemini_api_key: e.target.value })}
              placeholder="AIza..."
              className="pr-10"
              disabled={!config.enabled}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowApiKey(!showApiKey)}
              disabled={!config.enabled}
            >
              {showApiKey ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            Obtenha sua API key em{' '}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              aistudio.google.com
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="default-model">Modelo Padrão (Chat)</Label>
            <Select
              value={config.default_model}
              onValueChange={(value) => setConfig({ ...config, default_model: value })}
              disabled={!config.enabled}
            >
              <SelectTrigger id="default-model">
                <SelectValue placeholder="Selecione um modelo" />
              </SelectTrigger>
              <SelectContent>
                {CHAT_MODELS.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Usado para geração de relatórios e ATAs
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gemini-model">Modelo Gemini (Copiloto)</Label>
            <Select
              value={config.gemini_model}
              onValueChange={(value) => setConfig({ ...config, gemini_model: value })}
              disabled={!config.enabled}
            >
              <SelectTrigger id="gemini-model">
                <SelectValue placeholder="Selecione um modelo" />
              </SelectTrigger>
              <SelectContent>
                {GEMINI_MODELS.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Usado quando o copiloto de metas estiver configurado para Gemini
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transcription-model">Modelo de Transcrição</Label>
            <Select
              value={config.transcription_model}
              onValueChange={(value) => setConfig({ ...config, transcription_model: value })}
              disabled={!config.enabled}
            >
              <SelectTrigger id="transcription-model">
                <SelectValue placeholder="Selecione um modelo" />
              </SelectTrigger>
              <SelectContent>
                {TRANSCRIPTION_MODELS.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Usado para transcrição de áudio de reuniões
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="outline"
          onClick={testConnection}
          disabled={!config.enabled || testing}
        >
          {testing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : testResult === 'success' ? (
            <CheckCircle className="h-4 w-4 mr-2" style={{ color: 'hsl(var(--chart-2))' }} />
          ) : testResult === 'error' ? (
            <XCircle className="h-4 w-4 mr-2 text-destructive" />
          ) : null}
          Testar Conexão
        </Button>

        <Button onClick={saveConfig} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar Configuração
        </Button>
      </div>

      <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
        <span className="text-warning">⚠️</span>
        <p className="text-xs text-warning-foreground">
          As chaves serão armazenadas de forma segura e usadas apenas nas funções de IA do sistema.
          O provedor ativo do copiloto de metas pode ser alternado a qualquer momento.
        </p>
      </div>
    </Card>
  );
}
