import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/external-client';
import { Loader2, Mail, Save, Server, CheckCircle, XCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EmailConfig {
  enabled: boolean;
  provider: 'smtp';
  from_name: string;
  from_email: string;
  reply_to: string;
  smtp: {
    host: string;
    port: string;
    user: string;
    encryption: 'tls' | 'ssl' | 'none';
  };
  notifications: {
    meeting_created: boolean;
    meeting_reminder: boolean;
    task_assigned: boolean;
    invite_sent: boolean;
  };
}

const defaultConfig: EmailConfig = {
  enabled: true,
  provider: 'smtp',
  from_name: 'GA 360',
  from_email: 'noreply@ga360.com',
  reply_to: '',
  smtp: {
    host: '',
    port: '587',
    user: '',
    encryption: 'tls',
  },
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
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [config, setConfig] = useState<EmailConfig>(defaultConfig);
  const [smtpPassword, setSmtpPassword] = useState('');

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
        const savedConfig = data.value as unknown as EmailConfig;
        setConfig({
          ...defaultConfig,
          ...savedConfig,
          provider: 'smtp', // Force SMTP
          smtp: {
            ...defaultConfig.smtp,
            ...(savedConfig.smtp || {}),
          },
          notifications: {
            ...defaultConfig.notifications,
            ...(savedConfig.notifications || {}),
          },
        });
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
      // Ensure provider is always smtp
      const configToSave = { ...config, provider: 'smtp' as const };
      
      // Save config to system_settings (without password)
      const { error } = await supabase
        .from('system_settings')
        .upsert(
          {
            key: 'email_config',
            value: configToSave as any,
            description: 'Configurações de envio de e-mail',
          },
          { onConflict: 'key' }
        );

      if (error) throw error;

      // If SMTP password was entered, save it via edge function
      if (smtpPassword) {
        const { error: smtpError } = await supabase.functions.invoke('save-smtp-password', {
          body: { password: smtpPassword },
        });
        if (smtpError) {
          console.warn('Note: SMTP password storage requires manual configuration');
        }
      }

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

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Usa supabase.functions.invoke para que o token JWT seja adicionado automaticamente
      const { data, error } = await supabase.functions.invoke('test-smtp-connection', {
        body: {
          ...config.smtp,
          password: smtpPassword || undefined,
        },
      });

      if (error) throw new Error(error.message);

      if (data?.success) {
        setTestResult('success');
        toast({
          title: 'Conexão bem-sucedida!',
          description: data.message || 'O servidor SMTP está configurado corretamente.',
        });
      } else {
        setTestResult('error');
        toast({
          title: 'Falha na conexão',
          description: data?.message || 'Não foi possível conectar ao servidor SMTP.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      setTestResult('error');
      toast({
        title: 'Erro ao testar',
        description: error.message || 'Erro ao testar conexão SMTP.',
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
        <h3 className="text-lg font-semibold">Configurações de E-mail</h3>
        <p className="text-sm text-muted-foreground">
          Configure o servidor SMTP para envio de e-mails do sistema
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
          {/* SMTP Settings */}
          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Server className="h-5 w-5 text-primary" />
              <h4 className="font-medium">Configurações SMTP</h4>
              {testResult === 'success' && (
                <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
              )}
              {testResult === 'error' && (
                <XCircle className="h-4 w-4 text-destructive ml-auto" />
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="smtp_host">Servidor SMTP *</Label>
                <Input
                  id="smtp_host"
                  placeholder="smtp.seudominio.com.br"
                  value={config.smtp.host}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      smtp: { ...config.smtp, host: e.target.value },
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="smtp_port">Porta *</Label>
                  <Input
                    id="smtp_port"
                    placeholder="587"
                    value={config.smtp.port}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        smtp: { ...config.smtp, port: e.target.value },
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp_encryption">Criptografia</Label>
                  <Select
                    value={config.smtp.encryption}
                    onValueChange={(value: 'tls' | 'ssl' | 'none') =>
                      setConfig({
                        ...config,
                        smtp: { ...config.smtp, encryption: value },
                      })
                    }
                  >
                    <SelectTrigger id="smtp_encryption">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tls">TLS (STARTTLS)</SelectItem>
                      <SelectItem value="ssl">SSL</SelectItem>
                      <SelectItem value="none">Nenhuma</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="smtp_user">Usuário SMTP *</Label>
                <Input
                  id="smtp_user"
                  placeholder="sistema@seudominio.com.br"
                  value={config.smtp.user}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      smtp: { ...config.smtp, user: e.target.value },
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp_password">Senha SMTP *</Label>
                <Input
                  id="smtp_password"
                  type="password"
                  placeholder="••••••••••"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  A senha será armazenada de forma segura
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || !config.smtp.host || !config.smtp.port || !config.smtp.user}
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testando...
                </>
              ) : (
                'Testar Conexão'
              )}
            </Button>
          </Card>

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
                  Deve corresponder ao usuário SMTP ou alias autorizado
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
      <Button onClick={handleSave} disabled={saving} className="w-full">
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
  );
}
