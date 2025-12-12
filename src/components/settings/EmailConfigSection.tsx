import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Mail, Save } from 'lucide-react';

interface EmailConfig {
  enabled: boolean;
  from_name: string;
  from_email: string;
  reply_to: string;
  notifications: {
    meeting_created: boolean;
    meeting_reminder: boolean;
    task_assigned: boolean;
    invite_sent: boolean;
  };
}

const defaultConfig: EmailConfig = {
  enabled: true,
  from_name: 'GA 360',
  from_email: 'noreply@ga360.com',
  reply_to: '',
  notifications: {
    meeting_created: true,
    meeting_reminder: true,
    task_assigned: true,
    invite_sent: true,
  },
};

export function EmailConfigSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<EmailConfig>(defaultConfig);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'email_config')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      if (data?.value) {
        setConfig(data.value as unknown as EmailConfig);
      }
    } catch (error) {
      console.error('Error fetching email config:', error);
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
          key: 'email_config',
          value: config as any,
          description: 'Configurações de envio de e-mail',
        });

      if (error) throw error;

      toast({
        title: 'Configurações salvas!',
        description: 'As configurações de e-mail foram atualizadas.',
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
        <h3 className="text-lg font-semibold">Configurações de E-mail</h3>
        <p className="text-sm text-muted-foreground">
          Configure o envio de e-mails e notificações do sistema
        </p>
      </div>

      {/* Enable Email */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Habilitar E-mails</Label>
            <p className="text-xs text-muted-foreground">
              Ativar envio de e-mails pelo sistema
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
          {/* Sender Settings */}
          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Mail className="h-5 w-5 text-primary" />
              <h4 className="font-medium">Configurações do Remetente</h4>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="from_name">Nome do Remetente</Label>
                <Input
                  id="from_name"
                  placeholder="GA 360"
                  value={config.from_name}
                  onChange={(e) => setConfig({ ...config, from_name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="from_email">E-mail do Remetente</Label>
                <Input
                  id="from_email"
                  type="email"
                  placeholder="noreply@suaempresa.com"
                  value={config.from_email}
                  onChange={(e) => setConfig({ ...config, from_email: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Requer domínio verificado no Resend
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reply_to">E-mail de Resposta (Reply-To)</Label>
              <Input
                id="reply_to"
                type="email"
                placeholder="suporte@suaempresa.com"
                value={config.reply_to}
                onChange={(e) => setConfig({ ...config, reply_to: e.target.value })}
              />
            </div>
          </Card>

          {/* Notification Settings */}
          <Card className="p-4 space-y-4">
            <h4 className="font-medium pb-2 border-b">Notificações por E-mail</h4>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Reunião Criada</Label>
                  <p className="text-xs text-muted-foreground">
                    Notificar participantes sobre novas reuniões
                  </p>
                </div>
                <Switch
                  checked={config.notifications.meeting_created}
                  onCheckedChange={(checked) =>
                    setConfig({
                      ...config,
                      notifications: { ...config.notifications, meeting_created: checked },
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Lembretes de Reunião</Label>
                  <p className="text-xs text-muted-foreground">
                    Enviar lembretes antes das reuniões
                  </p>
                </div>
                <Switch
                  checked={config.notifications.meeting_reminder}
                  onCheckedChange={(checked) =>
                    setConfig({
                      ...config,
                      notifications: { ...config.notifications, meeting_reminder: checked },
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Tarefa Atribuída</Label>
                  <p className="text-xs text-muted-foreground">
                    Notificar usuários sobre novas tarefas
                  </p>
                </div>
                <Switch
                  checked={config.notifications.task_assigned}
                  onCheckedChange={(checked) =>
                    setConfig({
                      ...config,
                      notifications: { ...config.notifications, task_assigned: checked },
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Convites de Usuário</Label>
                  <p className="text-xs text-muted-foreground">
                    Enviar e-mails de convite para novos usuários
                  </p>
                </div>
                <Switch
                  checked={config.notifications.invite_sent}
                  onCheckedChange={(checked) =>
                    setConfig({
                      ...config,
                      notifications: { ...config.notifications, invite_sent: checked },
                    })
                  }
                />
              </div>
            </div>
          </Card>
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
