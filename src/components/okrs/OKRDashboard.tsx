import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, CheckCircle2, AlertCircle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

export function OKRDashboard() {
  const { selectedCompany } = useCompany();

  const { data: objectives } = useQuery({
    queryKey: ["okr-objectives-dashboard", selectedCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from("okr_objectives")
        .select(`
          *,
          okr_key_results (*)
        `)
        .eq("status", "active");

      if (selectedCompany) {
        query = query.eq("company_id", selectedCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const stats = {
    total: objectives?.length || 0,
    onTrack: objectives?.filter((o) => (o.progress || 0) >= 70).length || 0,
    atRisk: objectives?.filter((o) => (o.progress || 0) >= 30 && (o.progress || 0) < 70).length || 0,
    behind: objectives?.filter((o) => (o.progress || 0) < 30).length || 0,
    avgProgress: objectives?.length
      ? Math.round(objectives.reduce((acc, o) => acc + (o.progress || 0), 0) / objectives.length)
      : 0,
  };

  const statusData = [
    { name: "No caminho", value: stats.onTrack, color: "hsl(var(--chart-2))" },
    { name: "Em risco", value: stats.atRisk, color: "hsl(var(--chart-4))" },
    { name: "Atrasado", value: stats.behind, color: "hsl(var(--destructive))" },
  ].filter((d) => d.value > 0);

  const levelData = [
    { name: "Empresa", count: objectives?.filter((o) => o.level === "company").length || 0 },
    { name: "Área", count: objectives?.filter((o) => o.level === "area").length || 0 },
    { name: "Time", count: objectives?.filter((o) => o.level === "team").length || 0 },
    { name: "Individual", count: objectives?.filter((o) => o.level === "individual").length || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Objetivos</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">objetivos ativos</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Progresso Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgProgress}%</div>
            <Progress value={stats.avgProgress} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">No Caminho</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.onTrack}</div>
            <p className="text-xs text-muted-foreground">≥70% progresso</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Em Risco</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{stats.atRisk + stats.behind}</div>
            <p className="text-xs text-muted-foreground">&lt;70% progresso</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle>Status dos Objetivos</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                Nenhum objetivo ativo
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle>Objetivos por Nível</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={levelData}>
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Objectives */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle>Objetivos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {objectives?.slice(0, 5).map((objective) => (
              <div
                key={objective.id}
                className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/50"
              >
                <div className="space-y-1">
                  <p className="font-medium">{objective.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {objective.okr_key_results?.length || 0} Key Results
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold">{Math.round(objective.progress || 0)}%</p>
                  </div>
                  <Progress value={objective.progress || 0} className="w-24" />
                </div>
              </div>
            ))}
            {(!objectives || objectives.length === 0) && (
              <p className="text-center text-muted-foreground py-8">
                Nenhum objetivo encontrado
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
