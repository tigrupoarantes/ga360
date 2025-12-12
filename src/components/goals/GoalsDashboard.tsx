import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Target, TrendingUp, TrendingDown, Clock, CheckCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Goal {
  id: string;
  name: string;
  target_value: number;
  current_value: number;
  start_date: string;
  end_date: string;
  status: string;
  goal_types?: { name: string; unit: string } | null;
}

export function GoalsDashboard() {
  const { selectedCompanyId } = useCompany();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedCompanyId) {
      setGoals([]);
      setLoading(false);
      return;
    }

    const fetchGoals = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("goals")
        .select("*, goal_types(name, unit)")
        .eq("company_id", selectedCompanyId)
        .eq("status", "active")
        .order("end_date");

      if (data) setGoals(data);
      setLoading(false);
    };

    fetchGoals();
  }, [selectedCompanyId]);

  if (!selectedCompanyId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Selecione uma empresa para visualizar o dashboard de metas</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-24" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const completedGoals = goals.filter(g => (g.current_value / g.target_value) >= 1).length;
  const onTrackGoals = goals.filter(g => {
    const progress = g.current_value / g.target_value;
    return progress >= 0.7 && progress < 1;
  }).length;
  const atRiskGoals = goals.filter(g => (g.current_value / g.target_value) < 0.7).length;
  const avgProgress = goals.length > 0 
    ? goals.reduce((acc, g) => acc + (g.current_value / g.target_value * 100), 0) / goals.length 
    : 0;

  const chartData = goals.slice(0, 8).map(goal => ({
    name: goal.name.length > 15 ? goal.name.slice(0, 15) + "..." : goal.name,
    progresso: Math.min(100, (goal.current_value / goal.target_value) * 100),
    meta: 100,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Metas</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{goals.length}</div>
            <p className="text-xs text-muted-foreground">metas ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedGoals}</div>
            <p className="text-xs text-muted-foreground">100% atingido</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">No Caminho</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{onTrackGoals}</div>
            <p className="text-xs text-muted-foreground">70-99% atingido</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Em Risco</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{atRiskGoals}</div>
            <p className="text-xs text-muted-foreground">&lt;70% atingido</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Progresso Geral</CardTitle>
          <CardDescription>Média de atingimento das metas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={avgProgress} className="flex-1" />
            <span className="text-2xl font-bold">{avgProgress.toFixed(1)}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Progresso por Meta</CardTitle>
            <CardDescription>Comparativo de atingimento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Progresso']}
                  />
                  <Bar dataKey="progresso" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.progresso >= 100 ? 'hsl(var(--chart-2))' : entry.progresso >= 70 ? 'hsl(var(--chart-1))' : 'hsl(var(--destructive))'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goals List */}
      {goals.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Metas Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {goals.map(goal => {
                const progress = Math.min(100, (goal.current_value / goal.target_value) * 100);
                const isCompleted = progress >= 100;
                const isOnTrack = progress >= 70;

                return (
                  <div key={goal.id} className="flex items-center gap-4 p-4 rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{goal.name}</p>
                        {goal.goal_types && (
                          <Badge variant="outline" className="shrink-0">
                            {goal.goal_types.name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <Progress value={progress} className="flex-1" />
                        <span className="text-sm font-medium w-16 text-right">
                          {progress.toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>
                          {goal.current_value.toLocaleString()} / {goal.target_value.toLocaleString()}
                          {goal.goal_types?.unit && ` ${goal.goal_types.unit}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Até {new Date(goal.end_date).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    <Badge 
                      variant={isCompleted ? "default" : isOnTrack ? "secondary" : "destructive"}
                      className="shrink-0"
                    >
                      {isCompleted ? "Concluída" : isOnTrack ? "No Caminho" : "Em Risco"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma meta cadastrada para esta empresa</p>
            <p className="text-sm">Comece criando tipos de meta e depois adicione suas metas</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
