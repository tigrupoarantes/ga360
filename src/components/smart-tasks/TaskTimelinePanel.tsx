import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TaskData } from "./TaskFormDialog";

type TaskStatus = "nao_iniciado" | "em_andamento" | "concluido" | "atrasado" | "cancelado";

const statusColors: Record<TaskStatus, string> = {
  nao_iniciado: "#9ca3af",
  em_andamento: "#3b82f6",
  concluido: "#22c55e",
  atrasado: "#f97316",
  cancelado: "#ef4444",
};

const statusLabels: Record<TaskStatus, string> = {
  nao_iniciado: "Não Iniciado",
  em_andamento: "Em Andamento",
  concluido: "Concluído",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

function resolveStatus(task: TaskData): TaskStatus {
  if (task.status === "concluido") return "concluido";
  if (task.status === "cancelado") return "cancelado";
  if (task.status === "atrasado") return "atrasado";
  const end = new Date(task.end_date);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (end < now && task.status !== "concluido") return "atrasado";
  if (task.status === "em_andamento") return "em_andamento";
  return "nao_iniciado";
}

interface TaskTimelinePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planTitle: string;
  tasks: TaskData[];
}

export function TaskTimelinePanel({
  open,
  onOpenChange,
  planTitle,
  tasks,
}: TaskTimelinePanelProps) {
  if (tasks.length === 0) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Timeline — {planTitle}</SheetTitle>
          </SheetHeader>
          <p className="text-muted-foreground text-center py-12">
            Nenhuma tarefa para exibir na timeline.
          </p>
        </SheetContent>
      </Sheet>
    );
  }

  // Compute date range
  const allDates = tasks.flatMap((t) => [new Date(t.start_date), new Date(t.end_date)]);
  const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
  const totalDays = Math.max(1, differenceInDays(maxDate, minDate));

  // Prepare chart data: each task gets an offset (from minDate) and a duration
  const chartData = tasks.map((task) => {
    const start = new Date(task.start_date);
    const end = new Date(task.end_date);
    const offset = differenceInDays(start, minDate);
    const duration = Math.max(1, differenceInDays(end, start));
    const resolved = resolveStatus(task);
    const assigneeName = task.assignee_name || "—";

    return {
      name: task.title.length > 30 ? task.title.substring(0, 30) + "..." : task.title,
      fullName: task.title,
      assignee: assigneeName,
      offset,
      duration,
      status: resolved,
      color: statusColors[resolved],
      startLabel: format(start, "dd/MM", { locale: ptBR }),
      endLabel: format(end, "dd/MM", { locale: ptBR }),
    };
  });

  // "Today" marker position
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOffset = differenceInDays(today, minDate);

  const chartHeight = Math.max(200, tasks.length * 50 + 60);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Timeline — {planTitle}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Legend */}
          <div className="flex flex-wrap gap-3">
            {(Object.keys(statusColors) as TaskStatus[]).map((s) => (
              <div key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: statusColors[s] }} />
                {statusLabels[s]}
              </div>
            ))}
          </div>

          {/* Gantt Chart */}
          <div className="rounded-lg border border-border/50 bg-background/50 p-4">
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              >
                <XAxis
                  type="number"
                  domain={[0, totalDays + 1]}
                  tickFormatter={(val: number) => {
                    const d = new Date(minDate);
                    d.setDate(d.getDate() + val);
                    return format(d, "dd/MM", { locale: ptBR });
                  }}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-popover border border-border rounded-lg p-3 shadow-md text-sm space-y-1">
                        <p className="font-semibold">{d.fullName}</p>
                        <p className="text-muted-foreground">Responsável: {d.assignee}</p>
                        <p className="text-muted-foreground">
                          {d.startLabel} → {d.endLabel} ({d.duration} dias)
                        </p>
                        <Badge
                          className={cn("text-xs mt-1")}
                          style={{ backgroundColor: d.color + "33", color: d.color }}
                        >
                          {statusLabels[d.status as TaskStatus]}
                        </Badge>
                      </div>
                    );
                  }}
                />
                {/* Invisible offset bar (stacked) */}
                <Bar dataKey="offset" stackId="gantt" fill="transparent" />
                {/* Visible duration bar */}
                <Bar dataKey="duration" stackId="gantt" radius={[4, 4, 4, 4]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
                {/* Today marker */}
                {todayOffset >= 0 && todayOffset <= totalDays && (
                  <ReferenceLine
                    x={todayOffset}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    label={{
                      value: "Hoje",
                      position: "top",
                      fill: "hsl(var(--primary))",
                      fontSize: 11,
                    }}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Task detail list */}
          <div className="space-y-2">
            {tasks.map((task) => {
              const resolved = resolveStatus(task);
              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/30"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.assignee_name || "Sem responsável"}{" "}
                      · {format(new Date(task.start_date), "dd/MM/yyyy", { locale: ptBR })} →{" "}
                      {format(new Date(task.end_date), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge
                    className="text-xs"
                    style={{
                      backgroundColor: statusColors[resolved] + "33",
                      color: statusColors[resolved],
                    }}
                  >
                    {statusLabels[resolved]}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
