import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { 
  ClipboardList, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp,
  Calendar,
  BarChart3
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { getNextExecutionDate, isProcessOverdue, frequencyLabels } from "@/lib/processUtils";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProcessStats {
  totalProcesses: number;
  activeProcesses: number;
  executionsThisMonth: number;
  completedThisMonth: number;
  overdueProcesses: number;
  completionRate: number;
}

interface ProcessExecution {
  process_id: string;
  process_name: string;
  count: number;
}

interface UpcomingProcess {
  id: string;
  name: string;
  frequency: string;
  nextExecution: Date;
  isOverdue: boolean;
}

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#10b981', '#f59e0b'];

export function ProcessDashboard() {
  const { selectedCompanyId } = useCompany();
  const [stats, setStats] = useState<ProcessStats>({
    totalProcesses: 0,
    activeProcesses: 0,
    executionsThisMonth: 0,
    completedThisMonth: 0,
    overdueProcesses: 0,
    completionRate: 0,
  });
  const [executionsByProcess, setExecutionsByProcess] = useState<ProcessExecution[]>([]);
  const [upcomingProcesses, setUpcomingProcesses] = useState<UpcomingProcess[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedCompanyId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);

      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      // Fetch processes with their executions
      const { data: processes } = await supabase
        .from("processes")
        .select(`
          id,
          name,
          frequency,
          is_active,
          process_executions(id, status, completed_at, started_at)
        `)
        .eq("company_id", selectedCompanyId);

      if (!processes) {
        setLoading(false);
        return;
      }

      // Calculate stats
      const totalProcesses = processes.length;
      const activeProcesses = processes.filter(p => p.is_active).length;
      
      let executionsThisMonth = 0;
      let completedThisMonth = 0;
      const executionCounts: Record<string, { name: string; count: number }> = {};
      const upcoming: UpcomingProcess[] = [];

      processes.forEach(process => {
        const executions = process.process_executions || [];
        
        // Count executions this month
        const monthExecutions = executions.filter(e => {
          const startDate = new Date(e.started_at);
          return startDate >= monthStart && startDate <= monthEnd;
        });
        
        executionsThisMonth += monthExecutions.length;
        completedThisMonth += monthExecutions.filter(e => e.status === 'completed').length;

        // Count by process for chart
        const completedCount = executions.filter(e => e.status === 'completed').length;
        if (completedCount > 0) {
          executionCounts[process.id] = { name: process.name, count: completedCount };
        }

        // Calculate next execution
        if (process.is_active) {
          const completedExecs = executions
            .filter(e => e.status === 'completed' && e.completed_at)
            .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime());
          
          const lastExecution = completedExecs.length > 0 
            ? new Date(completedExecs[0].completed_at!) 
            : null;
          
          const nextExecution = getNextExecutionDate(process.frequency, lastExecution);
          const overdue = isProcessOverdue(nextExecution);

          upcoming.push({
            id: process.id,
            name: process.name,
            frequency: process.frequency,
            nextExecution,
            isOverdue: overdue,
          });
        }
      });

      const overdueProcesses = upcoming.filter(p => p.isOverdue).length;
      const completionRate = executionsThisMonth > 0 
        ? (completedThisMonth / executionsThisMonth) * 100 
        : 100;

      setStats({
        totalProcesses,
        activeProcesses,
        executionsThisMonth,
        completedThisMonth,
        overdueProcesses,
        completionRate,
      });

      // Top 5 processes by executions
      const sortedExecutions = Object.entries(executionCounts)
        .map(([id, data]) => ({ process_id: id, process_name: data.name, count: data.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      setExecutionsByProcess(sortedExecutions);

      // Sort upcoming by date
      upcoming.sort((a, b) => a.nextExecution.getTime() - b.nextExecution.getTime());
      setUpcomingProcesses(upcoming.slice(0, 5));

      setLoading(false);
    };

    fetchData();
  }, [selectedCompanyId]);

  if (!selectedCompanyId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-muted-foreground">
          <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Selecione uma empresa para ver o dashboard</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="py-6">
              <div className="h-4 bg-muted rounded w-1/2 mb-2" />
              <div className="h-8 bg-muted rounded w-1/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const pieData = [
    { name: 'Concluídos', value: stats.completedThisMonth },
    { name: 'Outros', value: stats.executionsThisMonth - stats.completedThisMonth },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Processos</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProcesses}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeProcesses} ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Execuções do Mês</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.executionsThisMonth}</div>
            <p className="text-xs text-muted-foreground">
              {stats.completedThisMonth} concluídas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conclusão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completionRate.toFixed(0)}%</div>
            <Progress value={stats.completionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processos Atrasados</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${stats.overdueProcesses > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.overdueProcesses > 0 ? 'text-destructive' : ''}`}>
              {stats.overdueProcesses}
            </div>
            <p className="text-xs text-muted-foreground">
              de {stats.activeProcesses} ativos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Executions by Process Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Execuções por Processo
            </CardTitle>
            <CardDescription>Top 5 processos mais executados</CardDescription>
          </CardHeader>
          <CardContent>
            {executionsByProcess.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Nenhuma execução registrada
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={executionsByProcess} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis 
                    dataKey="process_name" 
                    type="category" 
                    width={120}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Processes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Próximas Execuções
            </CardTitle>
            <CardDescription>Processos programados para os próximos dias</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingProcesses.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Nenhum processo ativo
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingProcesses.map(process => (
                  <div 
                    key={process.id} 
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      process.isOverdue ? 'border-destructive bg-destructive/10' : ''
                    }`}
                  >
                    <div>
                      <p className="font-medium text-sm">{process.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {frequencyLabels[process.frequency]}
                        </Badge>
                        {process.isOverdue && (
                          <Badge variant="destructive" className="text-xs">
                            Atrasado
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${process.isOverdue ? 'text-destructive' : ''}`}>
                        {format(process.nextExecution, "dd/MM", { locale: ptBR })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(process.nextExecution, "EEEE", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
