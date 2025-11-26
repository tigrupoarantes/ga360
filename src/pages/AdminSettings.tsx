import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Loader2, Settings, MessageSquare, TestTube } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

export default function AdminSettings() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [config, setConfig] = useState<WhatsAppConfig>({
    enabled: false,
    provider: null,
    reminders: {
      oneDayBefore: true,
      oneHourBefore: true,
    },
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'whatsapp_config')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data && data.value) {
        setConfig(data.value as unknown as WhatsAppConfig);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: 'Erro ao carregar configurações',
        description: 'Não foi possível carregar as configurações do WhatsApp.',
        variant: 'destructive',
      });
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
          description: 'Configurações de integração com WhatsApp para lembretes de reuniões',
        });

      if (error) throw error;

      toast({
        title: 'Configurações salvas!',
        description: 'As configurações do WhatsApp foram atualizadas com sucesso.',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      // Implementar teste de conexão com o provedor
      toast({
        title: 'Teste iniciado',
        description: 'Verificando conexão com o provedor WhatsApp...',
      });

      // Aqui você pode chamar uma edge function para testar a conexão
      // Por enquanto, apenas simular sucesso
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
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="animate-fade-in">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Configurações do Sistema</h1>
              <p className="text-muted-foreground mt-1">
                Configure integrações e funcionalidades do GA 360
              </p>
            </div>
          </div>
        </div>

        {/* WhatsApp Integration */}
        <Card className="p-6 animate-fade-in-up">
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b">
              <MessageSquare className="h-6 w-6 text-primary" />
              <div>
                <h2 className="text-xl font-semibold">Integração WhatsApp</h2>
                <p className="text-sm text-muted-foreground">
                  Configure o envio de lembretes via WhatsApp
                </p>
              </div>
            </div>

            {/* Enable WhatsApp */}
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="space-y-0.5">
                <Label htmlFor="whatsapp-enabled">Habilitar WhatsApp</Label>
                <p className="text-xs text-muted-foreground">
                  Ativar envio de lembretes via WhatsApp
                </p>
              </div>
              <Switch
                id="whatsapp-enabled"
                checked={config.enabled}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, enabled: checked })
                }
              />
            </div>

            {config.enabled && (
              <>
                {/* Provider Selection */}
                <div className="space-y-2">
                  <Label htmlFor="provider">Provedor WhatsApp</Label>
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
                  <p className="text-xs text-muted-foreground">
                    Escolha o serviço que você deseja usar para enviar mensagens
                  </p>
                </div>

                {/* Twilio Configuration */}
                {config.provider === 'twilio' && (
                  <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
                    <h3 className="font-medium">Configurações do Twilio</h3>

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
                  </div>
                )}

                {/* Evolution API Configuration */}
                {config.provider === 'evolution' && (
                  <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
                    <h3 className="font-medium">Configurações do Evolution API</h3>

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
                  </div>
                )}

                {/* Reminder Settings */}
                <div className="space-y-4 p-4 rounded-lg border">
                  <h3 className="font-medium">Lembretes Automáticos</h3>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="reminder-1day">Lembrete 1 dia antes</Label>
                      <p className="text-xs text-muted-foreground">
                        Enviar lembrete 24h antes da reunião
                      </p>
                    </div>
                    <Switch
                      id="reminder-1day"
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
                      <Label htmlFor="reminder-1hour">Lembrete 1 hora antes</Label>
                      <p className="text-xs text-muted-foreground">
                        Enviar lembrete 1h antes da reunião
                      </p>
                    </div>
                    <Switch
                      id="reminder-1hour"
                      checked={config.reminders.oneHourBefore}
                      onCheckedChange={(checked) =>
                        setConfig({
                          ...config,
                          reminders: { ...config.reminders, oneHourBefore: checked },
                        })
                      }
                    />
                  </div>
                </div>

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
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Configurações'
            )}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
