import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { D4SignTemplateEditor } from './D4SignTemplateEditor';

interface Template {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  template_html: string | null;
  is_active: boolean;
  created_at: string;
}

interface Props {
  companyId: string;
}

export function D4SignTemplateManager({ companyId }: Props) {

  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ['d4sign-templates', companyId],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return [];

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-d4sign-templates`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ companyId }),
        },
      );

      if (!response.ok) return [];
      const result = await response.json();
      return result.templates ?? [];
    },
    enabled: true,
  });

  const deactivateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Não autenticado');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-d4sign-template`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ templateId, companyId, deactivate: true }),
        },
      );

      if (!response.ok) throw new Error('Falha ao desativar template');
    },
    onSuccess: () => {
      toast.success('Template desativado');
      queryClient.invalidateQueries({ queryKey: ['d4sign-templates', companyId] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });

  function openNew() {
    setEditingTemplate(null);
    setEditorOpen(true);
  }

  function openEdit(tpl: Template) {
    setEditingTemplate(tpl);
    setEditorOpen(true);
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Templates de Documentos
          </CardTitle>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Novo template
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse h-20 bg-muted rounded" />
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum template cadastrado. Crie o primeiro template para começar a gerar documentos.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((tpl) => (
                  <TableRow key={tpl.id}>
                    <TableCell className="font-medium">{tpl.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {tpl.description ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tpl.is_active ? 'default' : 'secondary'}>
                        {tpl.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(tpl.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(tpl)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(tpl)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <D4SignTemplateEditor
        companyId={companyId}
        template={editingTemplate}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar template?</AlertDialogTitle>
            <AlertDialogDescription>
              O template <strong>{deleteTarget?.name}</strong> será desativado e não poderá
              ser usado em novos documentos. Documentos já gerados não são afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deactivateMutation.mutate(deleteTarget.id)}
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
