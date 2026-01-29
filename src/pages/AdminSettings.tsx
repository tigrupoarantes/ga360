import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Settings, UserPlus, Mail, MessageSquare, Cog, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { InvitesList } from '@/components/settings/InvitesList';
import { EmailConfigSection } from '@/components/settings/EmailConfigSection';
import { WhatsAppConfigSection } from '@/components/settings/WhatsAppConfigSection';
import { StockAuditSettingsSection } from '@/components/settings/StockAuditSettingsSection';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export default function AdminSettings() {
  const navigate = useNavigate();

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
                Gerencie usuários, e-mails, integrações e configurações gerais
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="invites" className="animate-fade-in-up">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="invites" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Convites</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">E-mail</span>
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Auditoria</span>
            </TabsTrigger>
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Cog className="h-4 w-4" />
              <span className="hidden sm:inline">Geral</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invites" className="mt-6">
            <InvitesList />
          </TabsContent>

          <TabsContent value="email" className="mt-6">
            <EmailConfigSection />
          </TabsContent>

          <TabsContent value="whatsapp" className="mt-6">
            <WhatsAppConfigSection />
          </TabsContent>

          <TabsContent value="audit" className="mt-6">
            <StockAuditSettingsSection />
          </TabsContent>

          <TabsContent value="general" className="mt-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold">Configurações Gerais</h3>
                <p className="text-sm text-muted-foreground">
                  Configurações globais do sistema
                </p>
              </div>

              <Card className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Modo de Manutenção</Label>
                    <p className="text-xs text-muted-foreground">
                      Bloqueia acesso ao sistema para usuários comuns
                    </p>
                  </div>
                  <Switch disabled />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Logs de Auditoria</Label>
                    <p className="text-xs text-muted-foreground">
                      Registrar todas as ações dos usuários
                    </p>
                  </div>
                  <Switch defaultChecked disabled />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-confirmar Emails</Label>
                    <p className="text-xs text-muted-foreground">
                      Desabilitar verificação de email no cadastro
                    </p>
                  </div>
                  <Switch defaultChecked disabled />
                </div>
              </Card>

              <p className="text-xs text-muted-foreground text-center">
                Algumas configurações estão desabilitadas nesta versão.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
