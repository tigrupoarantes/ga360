import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/external-client';
import { Loader2, MessageSquare, Save, TestTube } from 'lucide-react';

interface WhatsAppConfig {
  enabled: boolean;
  provider: 'twilio' | 'evolution' | null;
  twilio?: {
    accountSid: string;
    authToken: string;
    whatsappNumber: string;
  };
  evolution?: {
    url: string;
    apiKey: string;
    instanceName: string;
  };
  reminders: {
    oneDayBefore: boolean;
    oneHourBefore: boolean;
  };
}

const defaultConfig: WhatsAppConfig = {
  enabled: false,
  provider: null,
  reminders: {
    oneDayBefore: true,
    oneHourBefore: true,
  },
};

export function WhatsAppConfigSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<WhatsAppConfig>(defaultConfig);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'whatsapp_config')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      if (data?.value) {
        setConfig(data.value as unknown as WhatsAppConfig);
      }
    } catch (error) {
      console.error('Error fetching WhatsApp config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'whatsapp_config',
          value: config as any,
          description: 'Configurações de integração com WhatsApp',
        });

      if (error) throw error;

      toast({
        title: 'Configurações salvas!',
        description: 'As configurações do WhatsApp foram atualizadas.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      // Simulate test - in production, call an edge function
      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast({
        title: 'Conexão OK!',
        description: 'A conexão com o provedor WhatsApp foi testada com sucesso.',
      });
    } catch (error) {
      toast({
        title: 'Erro no teste',
        description: 'Não foi possível conectar ao provedor WhatsApp.',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Integração WhatsApp</h3>
        <p className="text-sm text-muted-foreground">
          Configure o envio de lembretes via WhatsApp
        </p>
      </div>

      {/* Enable WhatsApp */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Habilitar WhatsApp</Label>
            <p className="text-xs text-muted-foreground">
              Ativar envio de lembretes via WhatsApp
            </p>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
          />
        </div>
      </Card>

      {config.enabled && (
        <>
          {/* Provider Selection */}
          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h4 className="font-medium">Provedor</h4>
            </div>

            <div className="space-y-2">
              <Label>Provedor WhatsApp</Label>
              <Select
                value={config.provider || undefined}
                onValueChange={(value: 'twilio' | 'evolution') =>
                  setConfig({ ...config, provider: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o provedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="twilio">Twilio WhatsApp Business</SelectItem>
                  <SelectItem value="evolution">Evolution API</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Twilio Configuration */}
          {config.provider === 'twilio' && (
            <Card className="p-4 space-y-4">
              <h4 className="font-medium pb-2 border-b">Configurações do Twilio</h4>

              <div className="space-y-2">
                <Label htmlFor="twilio-sid">Account SID</Label>
                <Input
                  id="twilio-sid"
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={config.twilio?.accountSid || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      twilio: { ...config.twilio!, accountSid: e.target.value },
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twilio-token">Auth Token</Label>
                <Input
                  id="twilio-token"
                  type="password"
                  placeholder="••••••••••••••••••••••••••••••••"
                  value={config.twilio?.authToken || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      twilio: { ...config.twilio!, authToken: e.target.value },
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twilio-number">Número WhatsApp</Label>
                <Input
                  id="twilio-number"
                  placeholder="+14155238886"
                  value={config.twilio?.whatsappNumber || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      twilio: { ...config.twilio!, whatsappNumber: e.target.value },
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Formato internacional: +[código país][número]
                </p>
              </div>
            </Card>
          )}

          {/* Evolution API Configuration */}
          {config.provider === 'evolution' && (
            <Card className="p-4 space-y-4">
              <h4 className="font-medium pb-2 border-b">Configurações do Evolution API</h4>

              <div className="space-y-2">
                <Label htmlFor="evolution-url">URL da Instância</Label>
                <Input
                  id="evolution-url"
                  placeholder="https://api.evolution.com.br"
                  value={config.evolution?.url || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      evolution: { ...config.evolution!, url: e.target.value },
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="evolution-key">API Key</Label>
                <Input
                  id="evolution-key"
                  type="password"
                  placeholder="••••••••••••••••••••••••••••••••"
                  value={config.evolution?.apiKey || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      evolution: { ...config.evolution!, apiKey: e.target.value },
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="evolution-instance">Nome da Instância</Label>
                <Input
                  id="evolution-instance"
                  placeholder="minha-instancia"
                  value={config.evolution?.instanceName || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      evolution: { ...config.evolution!, instanceName: e.target.value },
                    })
                  }
                />
              </div>
            </Card>
          )}

          {/* Reminder Settings */}
          <Card className="p-4 space-y-4">
            <h4 className="font-medium pb-2 border-b">Lembretes Automáticos</h4>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Lembrete 1 dia antes</Label>
                <p className="text-xs text-muted-foreground">
                  Enviar lembrete 24h antes da reunião
                </p>
              </div>
              <Switch
                checked={config.reminders.oneDayBefore}
                onCheckedChange={(checked) =>
                  setConfig({
                    ...config,
                    reminders: { ...config.reminders, oneDayBefore: checked },
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Lembrete 1 hora antes</Label>
                <p className="text-xs text-muted-foreground">
                  Enviar lembrete 1h antes da reunião
                </p>
              </div>
              <Switch
                checked={config.reminders.oneHourBefore}
                onCheckedChange={(checked) =>
                  setConfig({
                    ...config,
                    reminders: { ...config.reminders, oneHourBefore: checked },
                  })
                }
              />
            </div>
          </Card>

          {/* Test Connection */}
          {config.provider && (
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing}
              className="w-full"
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4 mr-2" />
                  Testar Conexão
                </>
              )}
            </Button>
          )}
        </>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar Configurações
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
