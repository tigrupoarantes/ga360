import { useCompany } from '@/contexts/CompanyContext';
import { CockpitFiltersProvider } from '@/contexts/CockpitFiltersContext';
import { useApiConnection } from '@/hooks/cockpit/useApiConnection';
import ApiConnectionCard from '@/components/cockpit/ApiConnectionCard';
import { CockpitFilters } from '@/components/cockpit/CockpitFilters';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Database } from 'lucide-react';
import { toast } from 'sonner';
import type { DlConnection } from '@/lib/cockpit-types';

function CockpitSettingsContent() {
  const { selectedCompany } = useCompany();
  const { connection, isLoading, saveConnection, testConnection, refetch } = useApiConnection();

  const handleSave = async (data: Partial<DlConnection>) => {
    try {
      await saveConnection(data);
      toast.success('Configuração de API salva com sucesso!');
    } catch {
      toast.error('Erro ao salvar configuração');
    }
  };

  return (
    <div>
      <CockpitFilters />
      <div className="p-6 space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações do Cockpit</h1>
          <p className="text-muted-foreground mt-1">
            Integração e parâmetros — {selectedCompany?.name}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* API Connection form */}
          {!isLoading && (
            <ApiConnectionCard
              connection={connection || undefined}
              onSave={handleSave}
              onTest={testConnection}
            />
          )}

          {/* Integration status */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle>Status da Integração</CardTitle>
              </div>
              <CardDescription>
                Status da última sincronização com o Datalake
              </CardDescription>
            </CardHeader>
            <CardContent>
              {connection ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Última sincronização</span>
                    <span className="text-sm font-medium">
                      {connection.lastSyncAt
                        ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(connection.lastSyncAt))
                        : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <span className={`text-sm font-medium ${connection.lastSyncStatus === 'success' ? 'text-success' : connection.lastSyncStatus === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {connection.lastSyncStatus === 'success' ? 'Conectado' : connection.lastSyncStatus === 'error' ? 'Erro' : connection.lastSyncStatus || '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground">URL configurada</span>
                    <span className="text-sm font-medium truncate max-w-[200px]" title={connection.baseUrl}>
                      {connection.baseUrl || '—'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhuma conexão configurada. Configure a URL da API ao lado.
                </div>
              )}
            </CardContent>
          </Card>

          {/* System info */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <CardTitle>Informações do Sistema</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'Módulo', value: 'Cockpit GA' },
                  { label: 'Backend', value: 'Supabase GA360' },
                  { label: 'DAB Proxy', value: 'Edge Function' },
                  { label: 'Versão', value: '1.0.0' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="text-sm font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function CockpitSettings() {
  return (
    <CockpitFiltersProvider>
      <CockpitSettingsContent />
    </CockpitFiltersProvider>
  );
}
