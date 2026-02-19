import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useControlePJ, usePJContract, usePJClosings } from "@/hooks/useControlePJ";
import { useCardPermissions } from "@/hooks/useCardPermissions";
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
  Users,
  DollarSign,
  Clock,
  Mail,
  Search,
  Plus,
  FileText,
  CalendarDays,
  Eye,
  MoreVertical,
  Send,
  Check,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface PJDashboardProps {
  cardId: string;
}

export function PJDashboard({ cardId }: PJDashboardProps) {
  const navigate = useNavigate();
  const { hasCardPermission } = useCardPermissions();
  const canFill = hasCardPermission(cardId, "fill");
  const canManage = hasCardPermission(cardId, "manage");

  const now = new Date();
  const defaultCompetence = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [competence, setCompetence] = useState(defaultCompetence);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { contracts, closings, isLoading, kpis } = useControlePJ(competence);

  // Dialogs
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<PJContract | null>(null);
  const [closingDialogOpen, setClosingDialogOpen] = useState(false);
  const [closingContract, setClosingContract] = useState<PJContract | null>(null);
  const [vacationDialogOpen, setVacationDialogOpen] = useState(false);
  const [vacationContract, setVacationContract] = useState<PJContract | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Hooks para ações de contrato e fechamento
  const contractHook = usePJContract();
  const closingHook = usePJClosings();

  // Merge contratos + closings
  const merged = contracts.map((contract) => {
    const closing = closings.find((c) => c.contract_id === contract.id);
    return { contract, closing };
  });

  // Filtro
  const filtered = merged.filter(({ contract, closing }) => {
    if (search) {
      const s = search.toLowerCase();
      if (
        !contract.name.toLowerCase().includes(s) &&
        !contract.document.toLowerCase().includes(s) &&
        !(contract.cost_center?.name || "").toLowerCase().includes(s)
      ) {
        return false;
      }
    }
    if (statusFilter !== "all") {
      if (statusFilter === "pending") {
        if (closing) return false;
      } else if (statusFilter === "draft") {
        if (!closing || closing.status !== "draft") return false;
      } else if (statusFilter === "closed") {
        if (!closing || closing.status !== "closed") return false;
      } else if (statusFilter === "paid") {
        if (!closing || closing.status !== "paid") return false;
      }
    }
    return contract.status === "active";
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="animate-fade-in-up">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">PJs Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalActive}</div>
          </CardContent>
        </Card>
        <Card className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Líquido</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpis.totalLiquid.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
            <p className="text-xs text-muted-foreground">Competência {competence}</p>
          </CardContent>
        </Card>
        <Card className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes de Fechamento</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.pendingClosing}</div>
          </CardContent>
        </Card>
        <Card className="animate-fade-in-up" style={{ animationDelay: "300ms" }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes de Envio</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.pendingEmail}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e ações */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar PJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Input
          type="month"
          value={competence}
          onChange={(e) => setCompetence(e.target.value)}
          className="w-40"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Sem fechamento</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="closed">Fechado</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
          </SelectContent>
        </Select>
        {canManage && (
          <Button
            onClick={() => {
              setEditingContract(null);
              setContractDialogOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo PJ</span>
          </Button>
        )}
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">Unidade/CC</TableHead>
                <TableHead className="hidden lg:table-cell">Gestor</TableHead>
                <TableHead className="text-right">Valor Mensal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Holerite</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    Nenhum PJ encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(({ contract, closing }) => (
                  <TableRow key={contract.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell
                      className="font-medium"
                      onClick={() => navigate(`/governanca-ec/pessoas-cultura/controle-pj/${contract.id}`)}
                    >
                      <div>{contract.name}</div>
                      <div className="text-xs text-muted-foreground">{contract.document}</div>
                    </TableCell>
                    <TableCell
                      className="hidden md:table-cell"
                      onClick={() => navigate(`/governanca-ec/pessoas-cultura/controle-pj/${contract.id}`)}
                    >
                      {contract.cost_center?.name || "—"}
                    </TableCell>
                    <TableCell
                      className="hidden lg:table-cell"
                      onClick={() => navigate(`/governanca-ec/pessoas-cultura/controle-pj/${contract.id}`)}
                    >
                      {contract.manager
                        ? `${contract.manager.first_name || ""} ${contract.manager.last_name || ""}`.trim()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(contract.monthly_value).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </TableCell>
                    <TableCell>
                      {closing ? (
                        <Badge className={CLOSING_STATUS_COLORS[closing.status]}>
                          {CLOSING_STATUS_LABELS[closing.status]}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Sem fechamento</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {closing?.email_status ? (
                        <Badge className={EMAIL_STATUS_COLORS[closing.email_status]}>
                          {EMAIL_STATUS_LABELS[closing.email_status]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              navigate(`/governanca-ec/pessoas-cultura/controle-pj/${contract.id}`)
                            }
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          {canFill && !closing && (
                            <DropdownMenuItem
                              onClick={() => {
                                setClosingContract(contract);
                                setClosingDialogOpen(true);
                              }}
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Criar Fechamento
                            </DropdownMenuItem>
                          )}
                          {canFill && (
                            <DropdownMenuItem
                              onClick={() => {
                                setVacationContract(contract);
                                setVacationDialogOpen(true);
                              }}
                            >
                              <CalendarDays className="h-4 w-4 mr-2" />
                              Lançar Folga
                            </DropdownMenuItem>
                          )}
                          {canFill && closing?.status === "closed" && (
                            <DropdownMenuItem onClick={() => closingHook.markAsPaid.mutate({ id: closing.id })}>
                              <Check className="h-4 w-4 mr-2" />
                              Marcar Pago
                            </DropdownMenuItem>
                          )}
                          {canFill && closing?.payslip_pdf_url && (
                            <DropdownMenuItem onClick={() => closingHook.resendPayslip.mutate(closing.id)}>
                              <Send className="h-4 w-4 mr-2" />
                              Reenviar Holerite
                            </DropdownMenuItem>
                          )}
                          {canManage && (
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingContract(contract);
                                setContractDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar Contrato
                            </DropdownMenuItem>
                          )}
                          {canManage && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteConfirmId(contract.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir Contrato
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <PJContractFormDialog
        open={contractDialogOpen}
        onOpenChange={setContractDialogOpen}
        editingContract={editingContract}
      />

      {closingContract && (
        <PJClosingFormDialog
          open={closingDialogOpen}
          onOpenChange={setClosingDialogOpen}
          contract={closingContract}
          competence={competence}
        />
      )}

      {vacationContract && (
        <PJVacationFormDialog
          open={vacationDialogOpen}
          onOpenChange={setVacationDialogOpen}
          contract={vacationContract}
        />
      )}

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato PJ?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todos os fechamentos e folgas vinculados serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirmId) {
                  contractHook.deleteContract.mutate(deleteConfirmId);
                }
                setDeleteConfirmId(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
