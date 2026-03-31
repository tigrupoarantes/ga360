import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useVIBatchGenerate, useVIEmployeesWithVerba, type EmployeeWithVerba } from '@/hooks/useVerbasIndenizatorias';
import { Loader2, SendHorizonal, CheckCircle2, XCircle, Users, AlertCircle } from 'lucide-react';

interface Template {
  id: string;
  name: string;
}

interface BatchResult {
  cpf: string;
  nome: string;
  ok: boolean;
  error?: string;
}

interface Props {
  companyId: string;
  open: boolean;
  onClose: () => void;
  defaultCompetencia?: string;
}

type EventType = 'VERBA_INDENIZATORIA' | 'ADIANT_INDENIZATORIA';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function formatCompetencia(competencia: string) {
  if (!competencia) return '';
  const [year, month] = competencia.split('-');
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${months[parseInt(month, 10) - 1]}/${year}`;
}

function getEventValue(emp: EmployeeWithVerba, eventType: EventType): number {
  return eventType === 'ADIANT_INDENIZATORIA' ? emp.valor_adiantamento : emp.valor_verba;
}

type Step = 'setup' | 'running' | 'done';

export function VIBatchGenerateDialog({ companyId, open, onClose, defaultCompetencia }: Props) {
  const batchMutation = useVIBatchGenerate();

  const [competencia, setCompetencia] = useState(defaultCompetencia || currentMonth());
  const [templateId, setTemplateId] = useState('');
  const [eventType, setEventType] = useState<EventType>('VERBA_INDENIZATORIA');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<Step>('setup');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BatchResult[]>([]);

  const { data: allEmployees = [], isLoading: loadingEmployees } = useVIEmployeesWithVerba(
    companyId, competencia,
  );

  // Filtrar por evento selecionado (mostrar só quem tem valor > 0 para o evento)
  const employees = useMemo(
    () => allEmployees.filter((e) => getEventValue(e, eventType) > 0),
    [allEmployees, eventType],
  );

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
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ companyId }),
        },
      );
      if (!resp.ok) return [];
      const data = await resp.json();
      return (data.templates ?? []).filter((t: Template & { is_active: boolean }) => t.is_active);
    },
    enabled: !!companyId && open,
  });

  const allCpfs = useMemo(() => employees.map((e) => e.cpf), [employees]);
  const allSelected = allCpfs.length > 0 && allCpfs.every((cpf) => selected.has(cpf));
  const someSelected = allCpfs.some((cpf) => selected.has(cpf));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allCpfs));
    }
  }

  function toggleOne(cpf: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cpf)) next.delete(cpf);
      else next.add(cpf);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(allCpfs));
  }

  const selectedEmployees = employees.filter((e) => selected.has(e.cpf));
  const totalVerba = selectedEmployees.reduce((s, e) => s + getEventValue(e, eventType), 0);

  async function handleRun() {
    if (!templateId || selected.size === 0) return;
    setStep('running');
    setProgress(0);
    setResults([]);

    const empList = selectedEmployees;
    const resultList: BatchResult[] = [];
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;

    for (let i = 0; i < empList.length; i++) {
      // Throttle: 1s delay entre chamadas (exceto primeira)
      if (i > 0) await new Promise(r => setTimeout(r, 1000));

      const emp = empList[i];
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-verba-indenizatoria-doc`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId,
            employeeCpf: emp.cpf,
            competencia,
            templateId,
            sendToSign: false,
            signerEmail: emp.email ?? undefined,
            eventType,
          }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Erro desconhecido');
        resultList.push({ cpf: emp.cpf, nome: emp.nome, ok: true });
      } catch (err) {
        resultList.push({
          cpf: emp.cpf,
          nome: emp.nome,
          ok: false,
          error: err instanceof Error ? err.message : 'Erro',
        });
      }
      setProgress(Math.round(((i + 1) / empList.length) * 100));
      setResults([...resultList]);
    }

    setStep('done');
  }

  function handleClose() {
    setStep('setup');
    setProgress(0);
    setResults([]);
    setSelected(new Set());
    onClose();
  }

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;

  const eventTypeLabel = eventType === 'ADIANT_INDENIZATORIA'
    ? 'Adiantamento de Verba Indenizatória'
    : 'Verba Indenizatória';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Gerar em Lote — Verbas Indenizatórias
          </DialogTitle>
        </DialogHeader>

        {/* ── STEP: SETUP ────────────────────────────────────── */}
        {step === 'setup' && (
          <div className="flex flex-col gap-4 overflow-hidden">
            {/* Linha de configuração */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Competência</Label>
                <input
                  type="month"
                  value={competencia}
                  onChange={(e) => {
                    setCompetencia(e.target.value);
                    setSelected(new Set());
                  }}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de evento</Label>
                <Select value={eventType} onValueChange={(v) => { setEventType(v as EventType); setSelected(new Set()); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VERBA_INDENIZATORIA">Verba Indenizatória</SelectItem>
                    <SelectItem value="ADIANT_INDENIZATORIA">Adiantamento de Verba Indenizatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Template de documento</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templates.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Crie um template em Admin → D4Sign → Templates.
                  </p>
                )}
              </div>
            </div>

            {/* Tabela de funcionários */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {loadingEmployees
                  ? 'Buscando funcionários...'
                  : `${employees.length} funcionário(s) com ${eventTypeLabel.toLowerCase()} em ${formatCompetencia(competencia)}`
                }
              </p>
              {employees.length > 0 && (
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={selectAll}>
                  Selecionar todos
                </Button>
              )}
            </div>

            <div className="overflow-auto rounded-md border flex-1 min-h-0" style={{ maxHeight: '320px' }}>
              {loadingEmployees ? (
                <div className="flex items-center justify-center h-24 gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando dados do Datalake...
                </div>
              ) : employees.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-24 gap-1 text-muted-foreground text-sm">
                  <AlertCircle className="h-5 w-5" />
                  <span>Nenhum funcionário com {eventTypeLabel.toLowerCase()} nesta competência.</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelected}
                          data-state={someSelected && !allSelected ? 'indeterminate' : undefined}
                          onCheckedChange={toggleAll}
                        />
                      </TableHead>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Cargo/Função</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp) => (
                      <TableRow
                        key={emp.cpf}
                        className="cursor-pointer"
                        onClick={() => toggleOne(emp.cpf)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(emp.cpf)}
                            onCheckedChange={() => toggleOne(emp.cpf)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{emp.nome}</TableCell>
                        <TableCell className="text-muted-foreground text-xs font-mono">{emp.cpf}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                          {emp.email || (
                            <span className="text-destructive">sem e-mail</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">
                          {emp.position || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[140px]">
                          {emp.accounting_company_name || '—'}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {formatCurrency(getEventValue(emp, eventType))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Rodapé de seleção */}
            {selected.size > 0 && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-2.5 flex items-center justify-between text-sm">
                <span className="font-medium">{selected.size} selecionado(s)</span>
                <span className="text-muted-foreground">Total: <span className="font-semibold text-foreground">{formatCurrency(totalVerba)}</span></span>
              </div>
            )}
          </div>
        )}

        {/* ── STEP: RUNNING ──────────────────────────────────── */}
        {step === 'running' && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>Gerando documentos como rascunho...</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground">
              {results.length} de {selectedEmployees.length} processados
            </p>
            <div className="overflow-auto rounded-md border max-h-52">
              <Table>
                <TableBody>
                  {results.map((r) => (
                    <TableRow key={r.cpf}>
                      <TableCell className="w-8 py-2">
                        {r.ok
                          ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                          : <XCircle className="h-4 w-4 text-destructive" />
                        }
                      </TableCell>
                      <TableCell className="py-2 font-medium text-sm">{r.nome}</TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">
                        {r.ok ? 'Rascunho gerado' : r.error}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* ── STEP: DONE ─────────────────────────────────────── */}
        {step === 'done' && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-green-500/10 border-green-500/20 p-4 text-center">
                <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-green-600">{okCount}</p>
                <p className="text-xs text-muted-foreground">enviados com sucesso</p>
              </div>
              <div className={`rounded-lg border p-4 text-center ${failCount > 0 ? 'bg-destructive/10 border-destructive/20' : 'bg-muted/40'}`}>
                {failCount > 0
                  ? <XCircle className="h-6 w-6 text-destructive mx-auto mb-1" />
                  : <CheckCircle2 className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                }
                <p className={`text-2xl font-bold ${failCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{failCount}</p>
                <p className="text-xs text-muted-foreground">com erro</p>
              </div>
            </div>

            {failCount > 0 && (
              <div className="rounded-md border max-h-40 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.filter((r) => !r.ok).map((r) => (
                      <TableRow key={r.cpf}>
                        <TableCell className="font-medium text-sm">{r.nome}</TableCell>
                        <TableCell className="text-xs text-destructive">{r.error}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {okCount > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Documentos gerados como rascunho. Feche esta janela e clique em
                <strong> "Enviar rascunho(s)" </strong> para enviar todos a D4Sign automaticamente.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="mt-auto pt-2">
          {step === 'setup' && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button
                onClick={handleRun}
                disabled={selected.size === 0 || !templateId || batchMutation.isPending}
              >
                <SendHorizonal className="h-4 w-4 mr-2" />
                Gerar rascunhos {selected.size > 0 ? `(${selected.size})` : ''}
              </Button>
            </>
          )}
          {step === 'running' && (
            <Button variant="outline" disabled>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Processando...
            </Button>
          )}
          {step === 'done' && (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
