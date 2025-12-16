import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "./AnalyticsFilters";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Loader2 } from "lucide-react";

interface TasksAnalyticsProps {
  dateRange: DateRange;
  companyId: string | null;
  areaId: string | null;
  compact?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "hsl(var(--warning))",
  in_progress: "hsl(var(--primary))",
  completed: "hsl(var(--success))",
  cancelled: "hsl(var(--muted-foreground))",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "hsl(var(--muted-foreground))",
  medium: "hsl(var(--warning))",
  high: "hsl(var(--destructive))",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em Progresso",
  completed: "Concluída",
  cancelled: "Cancelada",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

export function TasksAnalytics({ dateRange, companyId, areaId, compact }: TasksAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [priorityData, setPriorityData] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [overdueByWeek, setOverdueByWeek] = useState<any[]>([]);

  useEffect(() => {
    fetchTasksData();
  }, [dateRange, companyId, areaId]);

  const fetchTasksData = async () => {
    setLoading(true);
    try {
      const { data: tasks } = await supabase
        .from("meeting_tasks")
        .select("id, status, priority, due_date, created_at, updated_at");

      if (tasks) {
        // Filter by date range
        const filteredTasks = tasks.filter((t) => {
          const taskDate = new Date(t.created_at);
          return taskDate >= dateRange.from && taskDate <= dateRange.to;
        });

        // Status distribution
        const statusDist = calculateStatusDistribution(filteredTasks);
        setStatusData(statusDist);

        // Priority distribution
        const priorityDist = calculatePriorityDistribution(filteredTasks);
        setPriorityData(priorityDist);

        // Weekly trend
        const weeklyTrend = calculateWeeklyTrend(filteredTasks);
        setTrendData(weeklyTrend);

        // Overdue analysis
        const overdueAnalysis = calculateOverdueByWeek(filteredTasks);
        setOverdueByWeek(overdueAnalysis);
      }
    } catch (error) {
      console.error("Error fetching tasks data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStatusDistribution = (tasks: any[]) => {
    const statuses: Record<string, number> = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };

    tasks.forEach((t) => {
      if (statuses[t.status] !== undefined) {
        statuses[t.status]++;
      }
    });

    return Object.entries(statuses)
      .filter(([_, value]) => value > 0)
      .map(([status, value]) => ({
        name: STATUS_LABELS[status] || status,
        value,
        status,
      }));
  };

  const calculatePriorityDistribution = (tasks: any[]) => {
    const priorities: Record<string, number> = { low: 0, medium: 0, high: 0 };

    tasks.forEach((t) => {
      if (priorities[t.priority] !== undefined) {
        priorities[t.priority]++;
      }
    });

    return Object.entries(priorities)
      .filter(([_, value]) => value > 0)
      .map(([priority, value]) => ({
        name: PRIORITY_LABELS[priority] || priority,
        value,
        priority,
      }));
  };

  const calculateWeeklyTrend = (tasks: any[]) => {
    const weeks: Record<string, { created: number; completed: number }> = {};

    tasks.forEach((task) => {
      const weekStart = getWeekStart(new Date(task.created_at));
      const key = weekStart.toISOString().split("T")[0];

      if (!weeks[key]) {
        weeks[key] = { created: 0, completed: 0 };
      }
      weeks[key].created++;

      if (task.status === "completed") {
        weeks[key].completed++;
      }
    });

    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([date, data]) => ({
        week: formatWeek(new Date(date)),
        ...data,
      }));
  };

  const calculateOverdueByWeek = (tasks: any[]) => {
    const now = new Date();
    const overdueTasks = tasks.filter((t) => {
      if (!t.due_date || t.status === "completed") return false;
      return new Date(t.due_date) < now;
    });

    const weeks: Record<string, number> = {};
    overdueTasks.forEach((task) => {
      const weekStart = getWeekStart(new Date(task.due_date));
      const key = weekStart.toISOString().split("T")[0];
      weeks[key] = (weeks[key] || 0) + 1;
    });

    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([date, count]) => ({
        week: formatWeek(new Date(date)),
        overdue: count,
      }));
  };

  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const formatWeek = (date: Date) => {
    const day = date.getDate();
    const month = date.toLocaleDateString("pt-BR", { month: "short" });
    return `${day} ${month}`;
  };

  if (loading) {
    return (
      <Card className={compact ? "" : "col-span-full"}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="text-lg">Status das Tarefas</CardTitle>
          <CardDescription>Distribuição atual</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-fade-in">
      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Status</CardTitle>
          <CardDescription>Tarefas por estado atual</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  dataKey="value"
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Priority Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Prioridade</CardTitle>
          <CardDescription>Tarefas por nível de prioridade</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="value" name="Tarefas" radius={[0, 4, 4, 0]}>
                  {priorityData.map((entry) => (
                    <Cell key={entry.priority} fill={PRIORITY_COLORS[entry.priority]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Tendência Semanal</CardTitle>
          <CardDescription>Tarefas criadas vs concluídas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="created"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  name="Criadas"
                  dot={{ fill: "hsl(var(--primary))" }}
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  stroke="hsl(var(--success))"
                  strokeWidth={2}
                  name="Concluídas"
                  dot={{ fill: "hsl(var(--success))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Overdue Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Tarefas Atrasadas</CardTitle>
          <CardDescription>Distribuição por semana de vencimento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overdueByWeek}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar
                  dataKey="overdue"
                  name="Atrasadas"
                  fill="hsl(var(--destructive))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
