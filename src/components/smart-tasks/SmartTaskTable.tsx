import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { SmartTask } from "./SmartTaskFormDialog";

interface SmartTaskTableProps {
  tasks: SmartTask[];
  isLoading: boolean;
  onEdit: (task: SmartTask) => void;
  onDelete: (id: string) => void;
}

export type ResolvedStatus =
  | "nao_iniciado"
  | "em_andamento"
  | "concluido"
  | "atrasado"
  | "cancelado";

const statusConfig: Record<ResolvedStatus, { label: string; className: string }> = {
  nao_iniciado: { label: "Não Iniciado", className: "bg-muted text-muted-foreground" },
  em_andamento: { label: "Em Andamento", className: "bg-primary/20 text-primary" },
  concluido: { label: "Concluído", className: "bg-green-500/20 text-green-500" },
  atrasado: { label: "Atrasado", className: "bg-destructive/20 text-destructive" },
  cancelado: { label: "Cancelado", className: "bg-muted text-muted-foreground line-through" },
};

export function resolveStatus(task: SmartTask): ResolvedStatus {
  if (task.status === "completed") return "concluido";
  if (task.status === "cancelled") return "cancelado";
  const endDate = new Date(task.end_date);
  if (isPast(endDate) && !isToday(endDate)) return "atrasado";
  if (task.status === "active") return "em_andamento";
  return "nao_iniciado";
}

export function SmartTaskTable({ tasks, isLoading, onEdit, onDelete }: SmartTaskTableProps) {
  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">Carregando...</div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma tarefa encontrada
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Nome da Tarefa</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Data Início</TableHead>
            <TableHead>Data Fim</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const resolved = resolveStatus(task);
            const cfg = statusConfig[resolved];

            return (
              <TableRow
                key={task.id}
                className={cn(
                  resolved === "atrasado" && "bg-destructive/5"
                )}
              >
                <TableCell className="font-medium">{task.title}</TableCell>
                <TableCell>{task.description || "—"}</TableCell>
                <TableCell>
                  {task.owner
                    ? `${task.owner.first_name || ""} ${task.owner.last_name || ""}`.trim()
                    : "—"}
                </TableCell>
                <TableCell>
                  {format(new Date(task.start_date), "dd/MM/yyyy", { locale: ptBR })}
                </TableCell>
                <TableCell>
                  {format(new Date(task.end_date), "dd/MM/yyyy", { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <Badge className={cn("text-xs", cfg.className)}>{cfg.label}</Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(task)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          if (confirm("Tem certeza que deseja excluir esta tarefa?")) {
                            onDelete(task.id);
                          }
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
