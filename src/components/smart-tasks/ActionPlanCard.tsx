import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Edit,
  Trash2,
  Plus,
  User,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TaskData } from "./TaskFormDialog";

type TaskStatus = "nao_iniciado" | "em_andamento" | "concluido" | "atrasado" | "cancelado";

const statusConfig: Record<TaskStatus, { label: string; className: string; barColor: string }> = {
  nao_iniciado: { label: "Não Iniciado", className: "bg-muted text-muted-foreground", barColor: "bg-gray-400" },
  em_andamento: { label: "Em Andamento", className: "bg-primary/20 text-primary", barColor: "bg-blue-500" },
  concluido: { label: "Concluído", className: "bg-green-500/20 text-green-500", barColor: "bg-green-500" },
  atrasado: { label: "Atrasado", className: "bg-destructive/20 text-destructive", barColor: "bg-orange-500" },
  cancelado: { label: "Cancelado", className: "bg-muted text-muted-foreground line-through", barColor: "bg-red-500" },
};

function resolveTaskStatus(task: TaskData): TaskStatus {
  if (task.status === "concluido") return "concluido";
  if (task.status === "cancelado") return "cancelado";
  if (task.status === "atrasado") return "atrasado";
  const endDate = new Date(task.end_date);
  if (isPast(endDate) && !isToday(endDate) && task.status !== "concluido") return "atrasado";
  if (task.status === "em_andamento") return "em_andamento";
  return "nao_iniciado";
}

export interface ActionPlanWithTasks {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: string;
  progress: number | null;
  defaultPlanId: string;
  tasks: TaskData[];
}

interface ActionPlanCardProps {
  plan: ActionPlanWithTasks;
  onEditPlan: () => void;
  onDeletePlan: () => void;
  onAddTask: () => void;
  onEditTask: (task: TaskData) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenTimeline: () => void;
}

export function ActionPlanCard({
  plan,
  onEditPlan,
  onDeletePlan,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onOpenTimeline,
}: ActionPlanCardProps) {
  const [expanded, setExpanded] = useState(false);

  const tasks = plan.tasks;
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => resolveTaskStatus(t) === "concluido").length;

  // Compute status distribution for progress bar
  const statusCounts: Record<TaskStatus, number> = {
    nao_iniciado: 0,
    em_andamento: 0,
    concluido: 0,
    atrasado: 0,
    cancelado: 0,
  };
  for (const t of tasks) {
    statusCounts[resolveTaskStatus(t)]++;
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 transition-all">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 mt-0.5"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <div className="flex-1 min-w-0 space-y-1">
              <h3 className="font-semibold text-base leading-tight">{plan.title}</h3>
              {plan.description && (
                <p className="text-sm text-muted-foreground truncate">{plan.description}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {format(new Date(plan.start_date), "dd/MM/yyyy", { locale: ptBR })} →{" "}
                  {format(new Date(plan.end_date), "dd/MM/yyyy", { locale: ptBR })}
                </span>
                <span className="font-medium">
                  {doneTasks}/{totalTasks} tarefas concluídas
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onOpenTimeline}
              title="Ver timeline"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEditPlan}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Plano
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onAddTask}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Tarefa
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDeletePlan} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Plano
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Progress bar colorida por status */}
        {totalTasks > 0 && (
          <div className="flex h-3 rounded-full overflow-hidden mt-3 bg-muted/30">
            {(["concluido", "em_andamento", "nao_iniciado", "atrasado", "cancelado"] as const).map(
              (status) => {
                const count = statusCounts[status];
                if (count === 0) return null;
                const pct = (count / totalTasks) * 100;
                return (
                  <div
                    key={status}
                    className={cn("transition-all", statusConfig[status].barColor)}
                    style={{ width: `${pct}%` }}
                    title={`${statusConfig[status].label}: ${count}`}
                  />
                );
              }
            )}
          </div>
        )}

        {/* Legend mini */}
        {totalTasks > 0 && (
          <div className="flex flex-wrap gap-3 mt-2">
            {(["em_andamento", "nao_iniciado", "concluido", "atrasado", "cancelado"] as const).map(
              (status) => {
                const count = statusCounts[status];
                if (count === 0) return null;
                return (
                  <div key={status} className="flex items-center gap-1 text-xs text-muted-foreground">
                    <div className={cn("w-2.5 h-2.5 rounded-full", statusConfig[status].barColor)} />
                    {statusConfig[status].label}
                  </div>
                );
              }
            )}
          </div>
        )}
      </CardHeader>

      {/* Expanded: tasks table */}
      {expanded && (
        <CardContent className="pt-0">
          {totalTasks === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma tarefa ainda.{" "}
              <button className="text-primary underline" onClick={onAddTask}>
                Adicionar tarefa
              </button>
            </p>
          ) : (
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarefa</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Data Início</TableHead>
                    <TableHead>Data Término</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => {
                    const resolved = resolveTaskStatus(task);
                    const cfg = statusConfig[resolved];

                    return (
                      <TableRow
                        key={task.id}
                        className={cn(
                          "cursor-pointer hover:bg-muted/50",
                          resolved === "atrasado" && "bg-destructive/5"
                        )}
                        onClick={() => onEditTask(task)}
                      >
                        <TableCell className="font-medium">{task.title}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {task.assignee
                              ? `${task.assignee.first_name || ""} ${task.assignee.last_name || ""}`.trim()
                              : "—"}
                          </span>
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
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditTask(task); }}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("Excluir esta tarefa?")) onDeleteTask(task.id);
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
          )}

          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 text-xs"
            onClick={onAddTask}
          >
            <Plus className="h-3 w-3 mr-1" />
            Nova Tarefa
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
