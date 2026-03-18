import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, Link2, UserCheck, Search, Save, Info } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useVIAccountingGroups, useCockpitVIConfig } from '@/hooks/useVerbasIndenizatorias';

type NivelAcesso = 'vendedor' | 'supervisor' | 'gerente' | 'diretoria';

interface VendorLink {
  id: string;
  user_id: string;
  company_id: string;
  cod_vendedor: string;
  nivel_acesso: NivelAcesso;
  ativo: boolean;
  created_at: string;
  profiles: { full_name: string; email: string } | null;
}

const NIVEL_LABELS: Record<NivelAcesso, string> = {
  vendedor:  'Vendedor',
  supervisor: 'Supervisor',
  gerente:   'Gerente',
  diretoria: 'Diretoria',
};

const NIVEL_COLORS: Record<NivelAcesso, string> = {
  vendedor:  'secondary',
  supervisor: 'default',
  gerente:   'default',
  diretoria: 'destructive',
};

export default function AdminCockpitVendas() {
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useCompany();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VendorLink | null>(null);
  const [form, setForm] = useState({
    user_email: '',
    cod_vendedor: '',
    nivel_acesso: 'vendedor' as NivelAcesso,
  });

  // Grupos contábeis — configuração de vendedores/promotores
  const [groupCompetencia, setGroupCompetencia] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [groupQueryEnabled, setGroupQueryEnabled] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const { data: availableGroups = [], isLoading: loadingGroups, isError: groupsError } =
    useVIAccountingGroups(
      groupQueryEnabled ? selectedCompanyId : null,
      groupCompetencia,
    );

  const { data: savedGroups = [] } = useCockpitVIConfig(selectedCompanyId ?? null);

  // Quando os grupos salvos carregam, inicializa a seleção local
  useEffect(() => {
    if (savedGroups.length > 0) setSelectedGroups(savedGroups);
  }, [savedGroups]);

  const saveGroupsMutation = useMutation({
    mutationFn: async (groups: string[]) => {
      const { error } = await supabase
        .from('cockpit_vi_config')
        .upsert(
          { company_id: selectedCompanyId, vi_accounting_groups: groups, updated_at: new Date().toISOString() },
          { onConflict: 'company_id' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cockpit-vi-config'] });
      toast.success('Configuração salva');
    },
    onError: () => toast.error('Erro ao salvar configuração'),
  });

  function toggleGroup(group: string) {
    setSelectedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group],
    );
  }

  // Busca vínculos com join em profiles
  const { data: links = [], isLoading } = useQuery<VendorLink[]>({
    queryKey: ['cockpit-vendor-links', selectedCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cockpit_user_vendor_link')
        .select('*, profiles(full_name, email)')
        .eq('company_id', selectedCompanyId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as VendorLink[];
    },
    enabled: !!selectedCompanyId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.user_email.trim()) throw new Error('Informe o e-mail do usuário');
      if (!form.cod_vendedor.trim()) throw new Error('Informe o código do vendedor no DAB');

      // Busca o user_id pelo e-mail
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', form.user_email.trim().toLowerCase())
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) throw new Error('Usuário não encontrado. Verifique o e-mail.');

      const { error } = await supabase.from('cockpit_user_vendor_link').insert({
        user_id:      profile.id,
        company_id:   selectedCompanyId,
        cod_vendedor: form.cod_vendedor.trim(),
        nivel_acesso: form.nivel_acesso,
      });
      if (error) {
        if (error.code === '23505') throw new Error('Este usuário já possui um vínculo nesta empresa.');
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cockpit-vendor-links'] });
      toast.success('Vínculo criado com sucesso');
      setCreateOpen(false);
      setForm({ user_email: '', cod_vendedor: '', nivel_acesso: 'vendedor' });
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao criar vínculo'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cockpit_user_vendor_link')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cockpit-vendor-links'] });
      toast.success('Vínculo removido');
      setDeleteTarget(null);
    },
    onError: () => toast.error('Erro ao remover vínculo'),
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('cockpit_user_vendor_link')
        .update({ ativo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cockpit-vendor-links'] });
      toast.success('Vínculo atualizado');
    },
    onError: () => toast.error('Erro ao atualizar vínculo'),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Cockpit de Vendas — Vínculos DAB
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Associe usuários do GA 360 aos códigos de vendedor/supervisor/gerente do Datalake (DAB)
          </p>
        </div>
        <div className="ml-auto">
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Vínculo
          </Button>
        </div>
      </div>

      {/* Tabela de vínculos */}
      <Card>
          <CardHeader>
            <CardTitle className="text-base">Vínculos configurados</CardTitle>
            <CardDescription>
              Usuários sem vínculo veem a tela "Perfil não vinculado" no Cockpit de Vendas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : links.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Nenhum vínculo configurado.</p>
                <p className="text-sm">Clique em "Novo Vínculo" para começar.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Cod. Vendedor (DAB)</TableHead>
                    <TableHead>Nível de Acesso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{link.profiles?.full_name ?? '—'}</p>
                          <p className="text-xs text-muted-foreground">{link.profiles?.email ?? link.user_id}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{link.cod_vendedor}</TableCell>
                      <TableCell>
                        <Badge variant={NIVEL_COLORS[link.nivel_acesso] as any}>
                          {NIVEL_LABELS[link.nivel_acesso]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => toggleAtivoMutation.mutate({ id: link.id, ativo: !link.ativo })}
                          className="cursor-pointer"
                        >
                          <Badge variant={link.ativo ? 'default' : 'outline'}>
                            {link.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(link.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(link)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

      {/* Grupos contábeis — Verbas Indenizatórias */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Grupos Contábeis — Verbas Indenizatórias</CardTitle>
          <CardDescription>
            Selecione quais grupos contábeis do DAB correspondem a vendedores e promotores.
            O dropdown de geração de documentos exibirá apenas funcionários desses grupos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Nota sobre sync */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Os grupos exibidos vêm dos dados já sincronizados pelo card de Verbas. Não é necessário
              sincronizar novamente aqui.
            </AlertDescription>
          </Alert>

          {/* Competência + Buscar */}
          <div className="flex items-end gap-3">
            <div className="space-y-1.5 flex-1 max-w-[200px]">
              <Label htmlFor="group-competencia">Competência</Label>
              <Input
                id="group-competencia"
                type="month"
                value={groupCompetencia}
                onChange={(e) => {
                  setGroupCompetencia(e.target.value);
                  setGroupQueryEnabled(false);
                }}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setGroupQueryEnabled(true)}
              disabled={loadingGroups}
            >
              <Search className="h-4 w-4 mr-2" />
              {loadingGroups ? 'Buscando...' : 'Buscar grupos'}
            </Button>
          </div>

          {/* Estados */}
          {loadingGroups && (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-6 w-full max-w-xs" />
              ))}
            </div>
          )}

          {groupsError && !loadingGroups && (
            <Alert variant="destructive">
              <AlertDescription>
                Erro ao buscar grupos. Verifique se há verbas sincronizadas para esta competência.
              </AlertDescription>
            </Alert>
          )}

          {groupQueryEnabled && !loadingGroups && !groupsError && availableGroups.length === 0 && (
            <Alert>
              <AlertDescription>
                Nenhum grupo contábil encontrado para esta competência. Verifique se o card de Verbas já
                foi sincronizado.
              </AlertDescription>
            </Alert>
          )}

          {availableGroups.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Grupos encontrados — marque os que são vendedores/promotores:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableGroups.map((group) => (
                  <label
                    key={group}
                    className="flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedGroups.includes(group)}
                      onCheckedChange={() => toggleGroup(group)}
                    />
                    <span className="text-sm">{group}</span>
                    {savedGroups.includes(group) && (
                      <Badge variant="secondary" className="ml-auto text-xs">Salvo</Badge>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Grupos já salvos (quando ainda não buscou) */}
          {!groupQueryEnabled && savedGroups.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">Grupos atualmente configurados:</p>
              <div className="flex flex-wrap gap-2">
                {savedGroups.map((g) => (
                  <Badge key={g} variant="default">{g}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Salvar */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={() => saveGroupsMutation.mutate(selectedGroups)}
              disabled={saveGroupsMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {saveGroupsMutation.isPending ? 'Salvando...' : 'Salvar configuração'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog criar vínculo */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Vínculo DAB</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="user_email">E-mail do usuário GA 360</Label>
              <Input
                id="user_email"
                type="email"
                placeholder="vendedor@grupoarantes.com.br"
                value={form.user_email}
                onChange={(e) => setForm((f) => ({ ...f, user_email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cod_vendedor">Código do vendedor no DAB</Label>
              <Input
                id="cod_vendedor"
                placeholder="ex: 1042"
                value={form.cod_vendedor}
                onChange={(e) => setForm((f) => ({ ...f, cod_vendedor: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Valor do campo <code>cod_vendedor</code> na view do Datalake.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Nível de acesso</Label>
              <Select
                value={form.nivel_acesso}
                onValueChange={(v) => setForm((f) => ({ ...f, nivel_acesso: v as NivelAcesso }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendedor">Vendedor — vê apenas os próprios dados</SelectItem>
                  <SelectItem value="supervisor">Supervisor — vê sua equipe</SelectItem>
                  <SelectItem value="gerente">Gerente — vê sua gerência</SelectItem>
                  <SelectItem value="diretoria">Diretoria — vê tudo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Salvando...' : 'Criar vínculo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog remover vínculo */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover vínculo?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário <strong>{deleteTarget?.profiles?.full_name ?? deleteTarget?.user_id}</strong> perderá
              acesso ao Cockpit de Vendas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
