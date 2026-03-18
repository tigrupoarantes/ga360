import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useVIGenerate, useVIEmployeesWithVerba, useVIAccountingGroups } from '@/hooks/useVerbasIndenizatorias';
import { resolveAccountingGroupLabel } from '@/lib/accountingGroups';
import { FileText, Send, Loader2, Users } from 'lucide-react';

interface Template {
  id: string;
  name: string;
}

interface Props {
  companyId: string;
  open: boolean;
  onClose: () => void;
  defaultCompetencia?: string;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function VIGenerateDialog({
  companyId,
  open,
  onClose,
  defaultCompetencia = '',
}: Props) {
  const generateMutation = useVIGenerate();

  const [competencia, setCompetencia] = useState(
    defaultCompetencia || new Date().toISOString().slice(0, 7),
  );
  const [selectedAccountingGroup, setSelectedAccountingGroup] = useState('');
  const [selectedCpf, setSelectedCpf] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [sendToSign, setSendToSign] = useState(false);

  const { data: availableGroups = [] } = useVIAccountingGroups(companyId, competencia);

  const { data: employees = [], isLoading: loadingEmployees } = useVIEmployeesWithVerba(
    companyId,
    competencia,
    selectedAccountingGroup ? [selectedAccountingGroup] : undefined,
  );

  const selectedEmployee = employees.find((e) => e.cpf === selectedCpf);

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ['d4sign-templates-list', companyId],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return [];

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-d4sign-templates`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '', 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId }),
        },
      );

      if (!resp.ok) return [];
      const data = await resp.json();
      return (data.templates ?? []).filter((t: Template & { is_active: boolean }) => t.is_active);
    },
    enabled: !!companyId && open,
  });

  async function handleGenerate() {
    if (!selectedCpf || !competencia || !templateId) return;

    await generateMutation.mutateAsync({
      companyId,
      employeeCpf: selectedCpf,
      competencia,
      templateId,
      sendToSign,
      signerEmail: selectedEmployee?.email || undefined,
    });

    onClose();
  }

  const isValid = !!selectedCpf && !!competencia && !!templateId;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar Documento de Verba Indenizatória</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Competência */}
          <div className="space-y-1.5">
            <Label htmlFor="gen-competencia">Competência</Label>
            <Input
              id="gen-competencia"
              type="month"
              value={competencia}
              onChange={(e) => {
                setCompetencia(e.target.value);
                setSelectedAccountingGroup('');
                setSelectedCpf('');
              }}
            />
          </div>

          {/* Grupo de Contabilização */}
          <div className="space-y-1.5">
            <Label>Grupo de Contabilização</Label>
            {competencia && availableGroups.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                Nenhum grupo com verba lançada para esta competência.
              </p>
            ) : (
              <Select
                value={selectedAccountingGroup || 'all'}
                onValueChange={(v) => {
                  setSelectedAccountingGroup(v === 'all' ? '' : v);
                  setSelectedCpf('');
                }}
                disabled={!competencia}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os grupos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os grupos</SelectItem>
                  {availableGroups.map((g) => (
                    <SelectItem key={g} value={g}>
                      {resolveAccountingGroupLabel(g)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Seleção de funcionário */}
          <div className="space-y-1.5">
            <Label htmlFor="gen-employee">Funcionário com verba lançada</Label>
            {loadingEmployees ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando funcionários com verba...
              </div>
            ) : employees.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                <Users className="h-4 w-4 shrink-0" />
                {selectedAccountingGroup
                  ? `Nenhum funcionário com verba no grupo "${resolveAccountingGroupLabel(selectedAccountingGroup)}" nesta competência.`
                  : 'Nenhum funcionário com VERBA INDENIZATÓRIA lançada nesta competência.'}
              </div>
            ) : (
              <Select value={selectedCpf} onValueChange={setSelectedCpf}>
                <SelectTrigger id="gen-employee">
                  <SelectValue placeholder={`Selecione (${employees.length} disponíveis)`} />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.cpf} value={emp.cpf}>
                      <span className="font-medium">{emp.nome}</span>
                      <span className="ml-2 text-muted-foreground text-xs">
                        {emp.cpf} — {formatCurrency(emp.valor_verba)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Detalhes do funcionário selecionado */}
          {selectedEmployee && (
            <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                {selectedEmployee.accounting_group && (
                  <Badge variant="secondary" className="text-xs">
                    {resolveAccountingGroupLabel(selectedEmployee.accounting_group)}
                  </Badge>
                )}
                {selectedEmployee.department && (
                  <Badge variant="outline" className="text-xs">{selectedEmployee.department}</Badge>
                )}
                {selectedEmployee.position && (
                  <Badge variant="outline" className="text-xs">{selectedEmployee.position}</Badge>
                )}
                {selectedEmployee.unit && (
                  <Badge variant="outline" className="text-xs">{selectedEmployee.unit}</Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                Verba: <span className="font-medium text-foreground">{formatCurrency(selectedEmployee.valor_verba)}</span>
                {selectedEmployee.valor_adiantamento > 0 && (
                  <> · Adiantamento: <span className="font-medium text-foreground">{formatCurrency(selectedEmployee.valor_adiantamento)}</span></>
                )}
              </p>
              {selectedEmployee.email && (
                <p className="text-muted-foreground text-xs">E-mail: {selectedEmployee.email}</p>
              )}
            </div>
          )}

          {/* Template */}
          <div className="space-y-1.5">
            <Label htmlFor="gen-template">Template de documento</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger id="gen-template">
                <SelectValue placeholder="Selecione um template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {templates.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum template ativo. Crie um em Admin → D4Sign → Templates.
              </p>
            )}
          </div>

          {/* Enviar para assinatura */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Enviar para assinatura</p>
              <p className="text-xs text-muted-foreground">
                Envia automaticamente para D4Sign após gerar o PDF
              </p>
            </div>
            <Switch checked={sendToSign} onCheckedChange={setSendToSign} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!isValid || generateMutation.isPending}
          >
            {sendToSign ? (
              <Send className="h-4 w-4 mr-2" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            {generateMutation.isPending
              ? 'Gerando...'
              : sendToSign
              ? 'Gerar e enviar'
              : 'Gerar documento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
