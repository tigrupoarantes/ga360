import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Save, X } from 'lucide-react';

interface Template {
  id?: string;
  company_id: string;
  name: string;
  description: string;
  template_html: string;
  is_active: boolean;
}

interface Props {
  companyId: string;
  template?: Template | null;
  open: boolean;
  onClose: () => void;
}

const PLACEHOLDERS = [
  { key: '{{nome_funcionario}}', desc: 'Nome completo do funcionário' },
  { key: '{{cpf}}', desc: 'CPF formatado' },
  { key: '{{empresa}}', desc: 'Razão social da empresa' },
  { key: '{{departamento}}', desc: 'Departamento' },
  { key: '{{cargo}}', desc: 'Cargo' },
  { key: '{{unidade}}', desc: 'Unidade' },
  { key: '{{competencia}}', desc: 'Ex: Março/2026' },
  { key: '{{valor_verba}}', desc: 'Valor da verba indenizatória' },
  { key: '{{valor_adiantamento}}', desc: 'Valor do adiantamento' },
  { key: '{{valor_total}}', desc: 'Soma das verbas' },
  { key: '{{data_geracao}}', desc: 'Data de geração do documento' },
  { key: '{{grupo_contabilizacao}}', desc: 'Grupo de contabilização' },
];

export function D4SignTemplateEditor({ companyId, template, open, onClose }: Props) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState<Template>({
    company_id: companyId,
    name: template?.name ?? '',
    description: template?.description ?? '',
    template_html: template?.template_html ?? '',
    is_active: template?.is_active ?? true,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Template) => {
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
          body: JSON.stringify({
            templateId: template?.id,
            companyId,
            template: data,
          }),
        },
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao salvar template');
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('Template salvo com sucesso');
      queryClient.invalidateQueries({ queryKey: ['d4sign-templates', companyId] });
      onClose();
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });

  function insertPlaceholder(key: string) {
    setForm((prev) => ({
      ...prev,
      template_html: prev.template_html + key,
    }));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template?.id ? 'Editar Template' : 'Novo Template de Documento'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Nome do template</Label>
              <Input
                id="tpl-name"
                placeholder="Ex: Termo de Verba Indenizatória"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-description">Descrição (opcional)</Label>
              <Input
                id="tpl-description"
                placeholder="Breve descrição do template"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Placeholders disponíveis</Label>
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDERS.map(({ key, desc }) => (
                <button
                  key={key}
                  type="button"
                  title={desc}
                  onClick={() => insertPlaceholder(key)}
                  className="text-xs font-mono px-2 py-1 rounded bg-muted hover:bg-muted/80 border border-border transition-colors"
                >
                  {key}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Clique em um placeholder para inserir no template.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-html">Conteúdo HTML do template</Label>
            <Textarea
              id="tpl-html"
              placeholder="<p>Olá, {{nome_funcionario}}...</p>"
              value={form.template_html}
              onChange={(e) => setForm((p) => ({ ...p, template_html: e.target.value }))}
              className="font-mono text-xs min-h-[300px]"
            />
            <p className="text-xs text-muted-foreground">
              Use HTML para formatar o documento. Os placeholders serão substituídos pelos dados reais na geração do PDF.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending || !form.name || !form.template_html}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? 'Salvando...' : 'Salvar template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
