import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Globe,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Save,
  Eye,
  EyeOff,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DlConnection } from '@/lib/cockpit-types';

interface ApiConnectionCardProps {
  connection?: DlConnection;
  onSave: (connection: Partial<DlConnection>) => Promise<void>;
  onTest: (connection: Partial<DlConnection>) => Promise<{ success: boolean; message: string }>;
}

function resolveFormData(connection?: DlConnection) {
  return {
    name: connection?.name || 'Datalake Principal',
    apiBaseUrl: connection?.baseUrl || '',
    apiKey: connection?.authConfigJson?.apiKey || connection?.authConfigJson?.api_key || '',
    authType: (connection?.authType || 'bearer') as 'bearer' | 'api_key' | 'basic',
    authHeader: connection?.authConfigJson?.authHeaderName || 'Authorization',
    extraHeaders: JSON.stringify(connection?.headersJson || {}, null, 2),
  };
}

export default function ApiConnectionCard({ connection, onSave, onTest }: ApiConnectionCardProps) {
  const [formData, setFormData] = useState(resolveFormData(connection));

  useEffect(() => {
    if (connection) setFormData(resolveFormData(connection));
  }, [connection]);

  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  function buildDlConnectionPayload(overrides?: Partial<typeof formData>): Partial<DlConnection> {
    const fd = { ...formData, ...overrides };
    let headersJson: Record<string, string> = {};
    try { headersJson = JSON.parse(fd.extraHeaders); } catch { headersJson = {}; }

    return {
      name: fd.name,
      baseUrl: fd.apiBaseUrl,
      authType: fd.authType,
      authConfigJson: {
        apiKey: fd.apiKey,
        authHeaderName: fd.authHeader,
      },
      headersJson,
    };
  }

  const handleSave = async () => {
    setIsSaving(true);
    try { await onSave(buildDlConnectionPayload()); }
    finally { setIsSaving(false); }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await onTest(buildDlConnectionPayload());
      setTestResult(result);
    } catch {
      setTestResult({ success: false, message: 'Erro ao testar conexão' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <CardTitle>Conexão com Datalake</CardTitle>
        </div>
        <CardDescription>
          Configure a conexão com a API do seu datalake para consumir dados em tempo real
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status from last sync */}
        {connection?.lastSyncStatus && (
          <div className={cn(
            'flex items-center justify-between p-4 rounded-lg',
            connection.lastSyncStatus === 'success' ? 'bg-success/10' : 'bg-destructive/10'
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center',
                connection.lastSyncStatus === 'success' ? 'bg-success/20' : 'bg-destructive/20'
              )}>
                {connection.lastSyncStatus === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
              </div>
              <div>
                <p className="font-medium">
                  {connection.lastSyncStatus === 'success' ? 'Conexão ativa' : 'Erro na conexão'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {connection.lastSyncAt
                    ? `Última verificação: ${new Intl.DateTimeFormat('pt-BR', {
                      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    }).format(new Date(connection.lastSyncAt))}`
                    : 'Nunca verificado'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="api-base-url">URL Base da API</Label>
            <Input
              id="api-base-url"
              placeholder="https://api.seudata.com/v1"
              value={formData.apiBaseUrl}
              onChange={(e) => setFormData({ ...formData, apiBaseUrl: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              URL base do seu datalake. Os endpoints serão adicionados automaticamente.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="auth-type">Tipo de Autenticação</Label>
            <Select
              value={formData.authType}
              onValueChange={(value) => setFormData({ ...formData, authType: value as 'bearer' | 'api_key' | 'basic' })}
            >
              <SelectTrigger id="auth-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bearer">Bearer Token</SelectItem>
                <SelectItem value="api_key">API Key (Header)</SelectItem>
                <SelectItem value="basic">Basic Auth</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="auth-header">Header de Autenticação</Label>
            <Input
              id="auth-header"
              placeholder="Authorization"
              value={formData.authHeader}
              onChange={(e) => setFormData({ ...formData, authHeader: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Ex: Authorization, X-API-Key</p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="api-key">Token / Chave de API</Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showApiKey ? 'text' : 'password'}
                placeholder="••••••••••••••••"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="extra-headers">Headers Adicionais (JSON)</Label>
            <Textarea
              id="extra-headers"
              placeholder='{"X-Custom-Header": "value"}'
              value={formData.extraHeaders}
              onChange={(e) => setFormData({ ...formData, extraHeaders: e.target.value })}
              className="font-mono text-sm h-20"
            />
            <p className="text-xs text-muted-foreground">Headers extras em formato JSON. Opcional.</p>
          </div>
        </div>

        {testResult && (
          <div className={cn(
            'p-4 rounded-lg flex items-center gap-3',
            testResult.success ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
          )}>
            {testResult.success ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            <span className="text-sm font-medium">{testResult.message}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={isTesting || !formData.apiBaseUrl}
            className="gap-2 flex-1"
          >
            {isTesting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Testar Conexão
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !formData.apiBaseUrl}
            className="gap-2 flex-1"
          >
            {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Configuração
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
