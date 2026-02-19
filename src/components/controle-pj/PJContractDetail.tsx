import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useCardPermissions } from "@/hooks/useCardPermissions";
import { usePJContract, usePJVacation, usePJClosings, usePJEmailLogs } from "@/hooks/useControlePJ";
import { PJContractFormDialog } from "./PJContractFormDialog";
import { PJClosingFormDialog } from "./PJClosingFormDialog";
import { PJVacationFormDialog } from "./PJVacationFormDialog";
import {
  PJ_STATUS_LABELS,
  PJ_STATUS_COLORS,
  CLOSING_STATUS_LABELS,
  CLOSING_STATUS_COLORS,
  EMAIL_STATUS_LABELS,
  EMAIL_STATUS_COLORS,
} from "@/lib/pj-types";
import type { PJContract, PJClosing } from "@/lib/pj-types";
import {
  FileText,
  CalendarDays,
  FileSpreadsheet,
  FolderOpen,
  Pencil,
  Plus,
  Send,
  Check,
  Download,
  Trash2,
  Eye,
  Mail,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/external-client";
import { toast } from "sonner";

interface PJContractDetailProps {
  contractId: string;
  cardId: string;
  initialTab?: string;
}

export function PJContractDetail({ contractId, cardId, initialTab = "contract" }: PJContractDetailProps) {
  const { hasCardPermission } = useCardPermissions();
  const canFill = hasCardPermission(cardId, "fill");
  const canManage = hasCardPermission(cardId, "manage");

  const { contract, isLoading } = usePJContract(contractId);
  const currentYear = new Date().getFullYear();
  const [vacationYear, setVacationYear] = useState(currentYear);
  const { events, balance, isLoading: vacLoading, deleteEvent } = usePJVacation(contractId, vacationYear);
  const { closings, isLoading: closingsLoading, markAsPaid, resendPayslip, deleteClosing } = usePJClosings(contractId);

  // Dialogs
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [closingDialogOpen, setClosingDialogOpen] = useState(false);
  const [closingEditId, setClosingEditId] = useState<string | undefined>();
  const [vacationDialogOpen, setVacationDialogOpen] = useState(false);
  const [emailLogClosingId, setEmailLogClosingId] = useState<string | null>(null);

  const fmt = (v: number) =>
    Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleDownloadPayslip = async (pdfUrl: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("holerites")
        .createSignedUrl(pdfUrl, 300);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch {
      toast.error("Erro ao baixar holerite");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!contract) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Contrato não encontrado
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">{contract.name}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge className={PJ_STATUS_COLORS[contract.status]}>
                  {PJ_STATUS_LABELS[contract.status]}
                </Badge>
                <span className="text-sm text-muted-foreground">{contract.document}</span>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">{contract.email}</span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span>Valor: <strong className="text-foreground">{fmt(contract.monthly_value)}</strong></span>
                {contract.company?.name && <span>Empresa: {contract.company.name}</span>}
                {contract.cost_center?.name && <span>CC: {contract.cost_center.name}</span>}
              </div>
            </div>
            {canFill && (
              <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="contract" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Contrato</span>
          </TabsTrigger>
          <TabsTrigger value="closings" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">Fechamentos</span>
          </TabsTrigger>
          <TabsTrigger value="vacation" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">Folgas</span>
          </TabsTrigger>
          <TabsTrigger value="docs" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Documentos</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Contrato */}
        <TabsContent value="contract" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoCard label="Gestor" value={
              contract.manager
                ? `${contract.manager.first_name || ""} ${contract.manager.last_name || ""}`.trim()
                : "—"
            } />
            <InfoCard label="Dia de Pagamento" value={contract.payment_day ? `Dia ${contract.payment_day}` : "—"} />
            <InfoCard label="Banco de Folgas" value={
              contract.vacation_enabled
                ? `${contract.vacation_entitlement_days} dias/ano`
                : "Desabilitado"
            } />
            <InfoCard label="13º Salário" value={
              contract.thirteenth_enabled
                ? `Mês ${contract.thirteenth_payment_month}`
                : "Desabilitado"
            } />
            <InfoCard label="14º (Meta)" value={contract.fourteenth_enabled ? "Habilitado" : "Desabilitado"} />
            <InfoCard label="Plano de Saúde" value={
              contract.health_enabled
                ? `${contract.health_dependents_count} dep. × ${fmt(contract.health_dependent_unit_value)}`
                : "Desabilitado"
            } />
          </div>
          {contract.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{contract.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Fechamentos */}
        <TabsContent value="closings" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Histórico de Fechamentos</h3>
            {canFill && (
              <Button
                size="sm"
                onClick={() => {
                  setClosingEditId(undefined);
                  setClosingDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" /> Novo Fechamento
              </Button>
            )}
          </div>

          {closingsLoading ? (
            <Skeleton className="h-48" />
          ) : closings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum fechamento encontrado
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Competência</TableHead>
                      <TableHead className="text-right">Base</TableHead>
                      <TableHead className="text-right">Descontos</TableHead>
                      <TableHead className="text-right">Líquido</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Holerite</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closings.map((closing) => {
                      const totalDiscounts =
                        Number(closing.restaurant_discount_value) +
                        Number(closing.health_dependents_discount_value) +
                        Number(closing.health_coparticipation_discount_value);
                      return (
                        <TableRow key={closing.id}>
                          <TableCell className="font-medium">{closing.competence}</TableCell>
                          <TableCell className="text-right">{fmt(closing.base_value)}</TableCell>
                          <TableCell className="text-right text-red-600">- {fmt(totalDiscounts)}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(closing.total_value)}</TableCell>
                          <TableCell>
                            <Badge className={CLOSING_STATUS_COLORS[closing.status]}>
                              {CLOSING_STATUS_LABELS[closing.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {closing.email_status ? (
                              <Badge className={EMAIL_STATUS_COLORS[closing.email_status]} variant="outline">
                                {EMAIL_STATUS_LABELS[closing.email_status]}
                              </Badge>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {closing.status === "draft" && canFill && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Editar"
                                  onClick={() => {
                                    setClosingEditId(closing.id);
                                    setClosingDialogOpen(true);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {closing.payslip_pdf_url && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Baixar Holerite"
                                  onClick={() => handleDownloadPayslip(closing.payslip_pdf_url!)}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                              {closing.status === "closed" && canFill && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Marcar Pago"
                                    onClick={() => markAsPaid.mutate({ id: closing.id })}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Reenviar Holerite"
                                    onClick={() => resendPayslip.mutate(closing.id)}
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {closing.status === "draft" && canManage && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Excluir"
                                  className="text-destructive"
                                  onClick={() => deleteClosing.mutate(closing.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Logs de E-mail"
                                onClick={() => setEmailLogClosingId(closing.id)}
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Banco de Folgas */}
        <TabsContent value="vacation" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold">Banco de Folgas</h3>
              <select
                className="border rounded px-2 py-1 text-sm bg-background"
                value={vacationYear}
                onChange={(e) => setVacationYear(parseInt(e.target.value))}
              >
                {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            {canFill && (
              <Button size="sm" onClick={() => setVacationDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Nova Folga
              </Button>
            )}
          </div>

          {/* Saldo Card */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-sm text-muted-foreground">Direito Anual</p>
                <p className="text-2xl font-bold">{balance?.entitlement_days || 30}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-sm text-muted-foreground">Utilizados</p>
                <p className="text-2xl font-bold text-orange-600">{balance?.used_days || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-sm text-muted-foreground">Saldo</p>
                <p className="text-2xl font-bold text-green-600">{balance?.remaining_days ?? 30}</p>
              </CardContent>
            </Card>
          </div>

          {vacLoading ? (
            <Skeleton className="h-48" />
          ) : events.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhuma folga registrada em {vacationYear}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Dias</TableHead>
                      <TableHead>Observação</TableHead>
                      {canManage && <TableHead className="text-right">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell>
                          {format(new Date(ev.start_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })} —{" "}
                          {format(new Date(ev.end_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right font-medium">{ev.days}</TableCell>
                        <TableCell className="text-muted-foreground">{ev.note || "—"}</TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => deleteEvent.mutate(ev.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Documentos */}
        <TabsContent value="docs" className="space-y-4">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>Área para upload de contratos, comprovantes e outros documentos.</p>
              <p className="text-sm mt-2">Funcionalidade em desenvolvimento (fase 2).</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <PJContractFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editingContract={contract}
      />

      {contract && (
        <PJClosingFormDialog
          open={closingDialogOpen}
          onOpenChange={setClosingDialogOpen}
          contract={contract}
          competence={`${currentYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`}
          editingClosingId={closingEditId}
          cardId={cardId}
        />
      )}

      {contract && (
        <PJVacationFormDialog
          open={vacationDialogOpen}
          onOpenChange={setVacationDialogOpen}
          contract={contract}
          year={vacationYear}
        />
      )}

      {/* Email Logs Dialog */}
      {emailLogClosingId && (
        <EmailLogsDialog
          closingId={emailLogClosingId}
          open={!!emailLogClosingId}
          onOpenChange={() => setEmailLogClosingId(null)}
        />
      )}
    </div>
  );
}

// Sub-component: Info Card
function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

// Sub-component: Email Logs Dialog
// (uses Dialog components imported at top of file)

function EmailLogsDialog({
  closingId,
  open,
  onOpenChange,
}: {
  closingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { logs, isLoading } = usePJEmailLogs(closingId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Logs de E-mail</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-32" />
        ) : logs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum log encontrado</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {logs.map((log) => (
              <Card key={log.id}>
                <CardContent className="pt-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{log.to_email}</span>
                    <Badge className={EMAIL_STATUS_COLORS[log.status]}>
                      {EMAIL_STATUS_LABELS[log.status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{log.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                  {log.error && (
                    <p className="text-xs text-destructive mt-1">{log.error}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
