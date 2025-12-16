import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "./AnalyticsFilters";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  RadialBarChart,
  RadialBar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Loader2, Target, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface GoalsAnalyticsProps {
  dateRange: DateRange;
  companyId: string | null;
  areaId: string | null;
  compact?: boolean;
}

const CHART_COLORS = [
  "hsl(var(--success))",
  "hsl(var(--primary))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
];

export function GoalsAnalytics({ dateRange, companyId, areaId, compact }: GoalsAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<any[]>([]);
  const [progressData, setProgressData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [typeData, setTypeData] = useState<any[]>([]);

  useEffect(() => {
    fetchGoalsData();
  }, [dateRange, companyId, areaId]);

  const fetchGoalsData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("goals")
        .select("*, goal_types(name, unit)")
        .eq("status", "active");

      if (companyId) query = query.eq("company_id", companyId);
      if (areaId) query = query.eq("area_id", areaId);

      const { data } = await query;

      if (data) {
        setGoals(data);

        // Progress distribution
        const progressDist = calculateProgressDistribution(data);
        setProgressData(progressDist);

        // Status distribution
        const statusDist = calculateStatusDistribution(data);
        setStatusData(statusDist);

        // By type
        const typeDist = calculateTypeDistribution(data);
        setTypeData(typeDist);
      }
    } catch (error) {
      console.error("Error fetching goals data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateProgressDistribution = (goals: any[]) => {
    return goals
      .map((g) => ({
        name: g.name.length > 20 ? g.name.slice(0, 20) + "..." : g.name,
        progress: Math.min(100, (g.current_value / g.target_value) * 100),
        target: 100,
        type: g.goal_types?.name || "Sem tipo",
      }))
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 10);
  };

  const calculateStatusDistribution = (goals: any[]) => {
    let completed = 0;
    let onTrack = 0;
    let atRisk = 0;
    let critical = 0;

    goals.forEach((g) => {
      const progress = (g.current_value / g.target_value) * 100;
      if (progress >= 100) completed++;
      else if (progress >= 70) onTrack++;
      else if (progress >= 40) atRisk++;
      else critical++;
    });

    return [
      { name: "Concluídas", value: completed, fill: "hsl(var(--success))" },
      { name: "No Caminho", value: onTrack, fill: "hsl(var(--primary))" },
      { name: "Em Risco", value: atRisk, fill: "hsl(var(--warning))" },
      { name: "Críticas", value: critical, fill: "hsl(var(--destructive))" },
    ].filter((d) => d.value > 0);
  };

  const calculateTypeDistribution = (goals: any[]) => {
    const types: Record<string, { count: number; avgProgress: number }> = {};

    goals.forEach((g) => {
      const typeName = g.goal_types?.name || "Sem tipo";
      if (!types[typeName]) {
        types[typeName] = { count: 0, avgProgress: 0 };
      }
      types[typeName].count++;
      types[typeName].avgProgress += (g.current_value / g.target_value) * 100;
    });

    return Object.entries(types).map(([name, data]) => ({
      name,
      count: data.count,
      avgProgress: Math.min(100, data.avgProgress / data.count),
    }));
  };

  const avgProgress = goals.length > 0
    ? goals.reduce((acc, g) => acc + (g.current_value / g.target_value) * 100, 0) / goals.length
    : 0;

  if (loading) {
    return (
      <Card className={compact ? "" : "col-span-full"}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (goals.length === 0) {
    return (
      <Card className={compact ? "" : "col-span-full"}>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Target className="h-12 w-12 mb-4 opacity-50" />
          <p>Nenhuma meta encontrada com os filtros selecionados</p>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="text-lg">Progresso das Metas</CardTitle>
          <CardDescription>Média geral: {avgProgress.toFixed(1)}%</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="30%"
                outerRadius="100%"
                barSize={20}
                data={statusData}
              >
                <RadialBar
                  label={{ position: "insideStart", fill: "hsl(var(--foreground))" }}
                  background
                  dataKey="value"
                />
                <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-fade-in">
      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Progresso Geral</CardTitle>
          <CardDescription>Média de atingimento das metas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Progress value={avgProgress} className="flex-1 h-4" />
              <span className="text-3xl font-bold">{avgProgress.toFixed(1)}%</span>
            </div>

            <div className="grid grid-cols-4 gap-4">
              {statusData.map((status) => (
                <div key={status.name} className="text-center">
                  <div
                    className="text-2xl font-bold"
                    style={{ color: status.fill }}
                  >
                    {status.value}
                  </div>
                  <div className="text-xs text-muted-foreground">{status.name}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Status</CardTitle>
          <CardDescription>Metas por nível de atingimento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
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

      {/* Progress by Goal */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Progresso por Meta</CardTitle>
          <CardDescription>Top 10 metas por atingimento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progressData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="name" type="category" width={150} />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(1)}%`, "Progresso"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="progress" name="Progresso" radius={[0, 4, 4, 0]}>
                  {progressData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.progress >= 100
                          ? "hsl(var(--success))"
                          : entry.progress >= 70
                          ? "hsl(var(--primary))"
                          : entry.progress >= 40
                          ? "hsl(var(--warning))"
                          : "hsl(var(--destructive))"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* By Type */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Metas por Tipo</CardTitle>
          <CardDescription>Quantidade e progresso médio por categoria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" orientation="left" />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="count" name="Quantidade" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="avgProgress" name="Progresso Médio (%)" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
