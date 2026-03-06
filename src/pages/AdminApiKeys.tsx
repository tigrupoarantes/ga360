import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/external-client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Copy, ExternalLink, Plug, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

// Computa SHA-256 hex no browser via Web Crypto API
async function sha256hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Gera uma nova API key no formato ga360_<48 hex chars>
function generateRawKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `ga360_${hex}`;
}

const PERMISSION_LABELS: Record<string, string> = {
  'goals:read': 'Metas — Leitura',
  'goals:write': 'Metas — Escrita',
  'meetings:read': 'Reuniões — Leitura',
  'meetings:write': 'Reuniões — Escrita',
  'kpis:read': 'KPIs Comerciais',
  'companies:read': 'Empresas — Leitura',
  'webhooks:read': 'Webhooks — Leitura',
  'webhooks:write': 'Webhooks — Escrita',
};

const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS);

export default function AdminApiKeys() {
  const { selectedCompanyId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(ALL_PERMISSIONS);
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealedKey, setRevealedKey] = useState('');
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: keys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ['api-keys', selectedCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('public_api_keys')
        .select('id, name, key_prefix, permissions, is_active, last_used_at, created_at')
        .eq('company_id', selectedCompanyId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedCompanyId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newKeyName.trim()) throw new Error('Informe um nome para a chave');
      const fullKey = generateRawKey();
      const hash = await sha256hex(fullKey);
      const prefix = fullKey.slice(0, 20);

      const { error } = await supabase.from('public_api_keys').insert({
        company_id: selectedCompanyId,
        name: newKeyName.trim(),
        key_hash: hash,
        key_prefix: prefix,
        permissions: newKeyPermissions,
      });
      if (error) throw error;
      return fullKey;
    },
    onSuccess: (fullKey) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setCreateOpen(false);
      setNewKeyName('');
      setNewKeyPermissions(ALL_PERMISSIONS);
      setRevealedKey(fullKey);
      setRevealOpen(true);
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao criar chave'),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('public_api_keys')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('Chave revogada');
      setRevokeTarget(null);
    },
    onError: () => toast.error('Erro ao revogar chave'),
  });

  function togglePermission(perm: string) {
    setNewKeyPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  }

  async function copyKey() {
    await navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const BASE_URL = 'https://zveqhxaiwghexfobjaek.supabase.co/functions/v1/public-api/v1';

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Plug className="h-6 w-6 text-emerald-600" />
              API & Integrações
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Chaves de API para n8n, MCP e automações externas
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open('/api-docs', '_blank')}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver Documentação
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Chave
            </Button>
          </div>
        </div>

        {/* Base URL info */}
        <Card className="p-4 bg-muted/30 border-dashed">
          <p className="text-sm font-medium text-muted-foreground mb-1">Base URL da API:</p>
          <code className="text-sm font-mono text-foreground break-all">{BASE_URL}</code>
          <p className="text-xs text-muted-foreground mt-2">
            Todas as requisições requerem o header <code className="bg-muted px-1 rounded">X-Api-Key: &lt;sua-chave&gt;</code>
          </p>
        </Card>

        {/* Keys list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : keys.length === 0 ? (
          <Card className="p-12 text-center">
            <Plug className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-medium text-muted-foreground">Nenhuma chave criada</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crie uma chave para integrar com n8n, Claude MCP ou outros sistemas.
            </p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeira chave
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <Card key={key.id} className={`p-4 ${!key.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{key.name}</span>
                      <Badge variant={key.is_active ? 'default' : 'secondary'} className="text-xs">
                        {key.is_active ? 'Ativa' : 'Revogada'}
                      </Badge>
                    </div>
                    <code className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {key.key_prefix}...
                    </code>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {key.permissions.map((p) => (
                        <Badge key={p} variant="outline" className="text-xs px-1.5 py-0">
                          {PERMISSION_LABELS[p] ?? p}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    {key.last_used_at ? (
                      <div className="flex items-center gap-1 justify-end text-emerald-600 mb-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Usado {format(new Date(key.last_used_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 justify-end text-muted-foreground mb-1">
                        <Clock className="h-3 w-3" />
                        Nunca usado
                      </div>
                    )}
                    <div className="text-muted-foreground/60">
                      Criado em {format(new Date(key.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </div>
                    {key.is_active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-destructive hover:text-destructive h-7 px-2"
                        onClick={() => setRevokeTarget(key)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Revogar
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* n8n + MCP quick-start */}
        <Card className="p-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Como usar
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium mb-1">n8n — HTTP Request</p>
              <pre className="bg-muted text-xs p-3 rounded-md overflow-x-auto leading-relaxed">{`URL: ${BASE_URL}/goals
Method: GET
Headers:
  X-Api-Key: ga360_sua_chave`}</pre>
            </div>
            <div>
              <p className="font-medium mb-1">Claude MCP (claude_desktop_config.json)</p>
              <pre className="bg-muted text-xs p-3 rounded-md overflow-x-auto leading-relaxed">{`{
  "mcpServers": {
    "ga360": {
      "command": "npx",
      "args": ["mcp-remote",
        "https://zveqhxaiwghexfobjaek.supabase.co
/functions/v1/mcp-server"],
      "headers": {
        "X-Api-Key": "ga360_sua_chave"
      }
    }
  }
}`}</pre>
            </div>
          </div>
        </Card>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome da chave</Label>
              <Input
                placeholder="Ex: n8n Produção, Claude MCP, Automação CRM"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Permissões</Label>
              <div className="mt-2 space-y-1.5">
                {ALL_PERMISSIONS.map((perm) => (
                  <label key={perm} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={newKeyPermissions.includes(perm)}
                      onChange={() => togglePermission(perm)}
                      className="rounded"
                    />
                    {PERMISSION_LABELS[perm]}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !newKeyName.trim()}
            >
              {createMutation.isPending ? 'Gerando...' : 'Gerar Chave'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal key dialog — shown ONCE */}
      <Dialog open={revealOpen} onOpenChange={(open) => { if (!open) setRevealedKey(''); setRevealOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              Chave criada com sucesso
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <strong>Atenção:</strong> Copie e guarde esta chave agora. Ela não será exibida novamente.
            </div>
            <div className="bg-muted rounded-lg p-3 font-mono text-sm break-all">
              {revealedKey}
            </div>
            <Button className="w-full" variant="outline" onClick={copyKey}>
              {copied ? <><CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" />Copiado!</> : <><Copy className="h-4 w-4 mr-2" />Copiar chave</>}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => { setRevealOpen(false); setRevealedKey(''); }}>
              Entendi, já copiei
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar chave "{revokeTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Integrações que usam esta chave param de funcionar imediatamente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => revokeTarget && revokeMutation.mutate(revokeTarget.id)}
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
