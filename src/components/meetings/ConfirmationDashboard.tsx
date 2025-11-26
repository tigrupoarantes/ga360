import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Clock, TrendingUp } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConfirmationStats {
  total: number;
  confirmed: number;
  declined: number;
  pending: number;
  confirmationRate: number;
}

interface TypeStats {
  type: string;
  total: number;
  confirmed: number;
  rate: number;
}

interface AreaStats {
  area: string;
  total: number;
  confirmed: number;
  rate: number;
}

const COLORS = {
  confirmed: "#22c55e",
  declined: "#ef4444",
  pending: "#f59e0b",
};

export function ConfirmationDashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30"); // dias
  const [overallStats, setOverallStats] = useState<ConfirmationStats>({
    total: 0,
    confirmed: 0,
    declined: 0,
    pending: 0,
    confirmationRate: 0,
  });
  const [typeStats, setTypeStats] = useState<TypeStats[]>([]);
  const [areaStats, setAreaStats] = useState<AreaStats[]>([]);

  useEffect(() => {
    fetchStats();
  }, [period]);

  const getDateRange = () => {
    const today = new Date();
    let startDate: Date;
    let endDate = today;

    switch (period) {
      case "7":
        startDate = subDays(today, 7);
        break;
      case "30":
        startDate = subDays(today, 30);
        break;
      case "90":
        startDate = subDays(today, 90);
        break;
      case "month":
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
        break;
      case "year":
        startDate = startOfYear(today);
        endDate = endOfYear(today);
        break;
      default:
        startDate = subDays(today, 30);
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();

      // Buscar todos os participantes de reuniões no período
      const { data: participants, error } = await supabase
        .from("meeting_participants")
        .select(`
          id,
          confirmation_status,
          meetings!inner(
            id,
            type,
            scheduled_at,
            areas(name)
          )
        `)
        .gte("meetings.scheduled_at", startDate)
        .lte("meetings.scheduled_at", endDate);

      if (error) throw error;

      if (!participants || participants.length === 0) {
        setOverallStats({
          total: 0,
          confirmed: 0,
          declined: 0,
          pending: 0,
          confirmationRate: 0,
        });
        setTypeStats([]);
        setAreaStats([]);
        setLoading(false);
        return;
      }

      // Calcular estatísticas gerais
      const total = participants.length;
      const confirmed = participants.filter((p) => p.confirmation_status === "confirmed").length;
      const declined = participants.filter((p) => p.confirmation_status === "declined").length;
      const pending = participants.filter((p) => p.confirmation_status === "pending").length;
      const confirmationRate = total > 0 ? (confirmed / total) * 100 : 0;

      setOverallStats({
        total,
        confirmed,
        declined,
        pending,
        confirmationRate,
      });

      // Agrupar por tipo de reunião
      const typeMap = new Map<string, { total: number; confirmed: number }>();
      participants.forEach((p: any) => {
        const meetingType = p.meetings.type;
        if (!typeMap.has(meetingType)) {
          typeMap.set(meetingType, { total: 0, confirmed: 0 });
        }
        const stats = typeMap.get(meetingType)!;
        stats.total++;
        if (p.confirmation_status === "confirmed") {
          stats.confirmed++;
        }
      });

      const typeStatsData = Array.from(typeMap.entries()).map(([type, stats]) => ({
        type,
        total: stats.total,
        confirmed: stats.confirmed,
        rate: stats.total > 0 ? (stats.confirmed / stats.total) * 100 : 0,
      }));

      setTypeStats(typeStatsData);

      // Agrupar por área
      const areaMap = new Map<string, { total: number; confirmed: number }>();
      participants.forEach((p: any) => {
        const areaName = p.meetings.areas?.name || "Sem área";
        if (!areaMap.has(areaName)) {
          areaMap.set(areaName, { total: 0, confirmed: 0 });
        }
        const stats = areaMap.get(areaName)!;
        stats.total++;
        if (p.confirmation_status === "confirmed") {
          stats.confirmed++;
        }
      });

      const areaStatsData = Array.from(areaMap.entries())
        .map(([area, stats]) => ({
          area,
          total: stats.total,
          confirmed: stats.confirmed,
          rate: stats.total > 0 ? (stats.confirmed / stats.total) * 100 : 0,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10); // Top 10 áreas

      setAreaStats(areaStatsData);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar estatísticas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const pieData = [
    { name: "Confirmados", value: overallStats.confirmed, color: COLORS.confirmed },
    { name: "Recusados", value: overallStats.declined, color: COLORS.declined },
    { name: "Pendentes", value: overallStats.pending, color: COLORS.pending },
  ].filter((item) => item.value > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtro de Período */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Período:</label>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="month">Este mês</SelectItem>
            <SelectItem value="year">Este ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards de Métricas Gerais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Convites</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.total}</div>
            <p className="text-xs text-muted-foreground">
              Participantes convidados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmados</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{overallStats.confirmed}</div>
            <p className="text-xs text-muted-foreground">
              {overallStats.confirmationRate.toFixed(1)}% do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recusados</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overallStats.declined}</div>
            <p className="text-xs text-muted-foreground">
              {overallStats.total > 0 ? ((overallStats.declined / overallStats.total) * 100).toFixed(1) : 0}% do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{overallStats.pending}</div>
            <p className="text-xs text-muted-foreground">
              {overallStats.total > 0 ? ((overallStats.pending / overallStats.total) * 100).toFixed(1) : 0}% do total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Gráfico de Pizza - Distribuição Geral */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Respostas</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Barras - Taxa de Confirmação por Tipo */}
        <Card>
          <CardHeader>
            <CardTitle>Taxa de Confirmação por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            {typeStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={typeStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  <Legend />
                  <Bar dataKey="rate" fill="#22c55e" name="Taxa de Confirmação (%)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela - Taxa de Confirmação por Área */}
      {areaStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Taxa de Confirmação por Área (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {areaStats.map((area) => (
                <div key={area.area} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{area.area}</p>
                    <p className="text-sm text-muted-foreground">
                      {area.confirmed} de {area.total} confirmados
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32 bg-muted rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${area.rate}%` }}
                      />
                    </div>
                    <span className="font-semibold text-sm w-12 text-right">
                      {area.rate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {overallStats.total === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              Nenhum dado de confirmação disponível para o período selecionado.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
