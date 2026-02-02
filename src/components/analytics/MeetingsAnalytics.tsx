import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/external-client";
import { DateRange } from "./AnalyticsFilters";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Loader2 } from "lucide-react";

interface MeetingsAnalyticsProps {
  dateRange: DateRange;
  companyId: string | null;
  areaId: string | null;
  compact?: boolean;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--accent))",
  "hsl(var(--info))",
  "hsl(var(--destructive))",
];

export function MeetingsAnalytics({ dateRange, companyId, areaId, compact }: MeetingsAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [typeData, setTypeData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);

  useEffect(() => {
    fetchMeetingsData();
  }, [dateRange, companyId, areaId]);

  const fetchMeetingsData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("meetings")
        .select("id, type, status, scheduled_at, duration_minutes, area_id")
        .gte("scheduled_at", dateRange.from.toISOString())
        .lte("scheduled_at", dateRange.to.toISOString());

      if (areaId) query = query.eq("area_id", areaId);

      const { data: meetings } = await query;

      if (meetings) {
        // Monthly trends
        const monthlyTrends = calculateMonthlyTrends(meetings);
        setTrendData(monthlyTrends);

        // Type distribution
        const typeDistribution = calculateTypeDistribution(meetings);
        setTypeData(typeDistribution);

        // Status distribution
        const statusDistribution = calculateStatusDistribution(meetings);
        setStatusData(statusDistribution);

        // Hourly distribution
        const hourlyDistribution = calculateHourlyDistribution(meetings);
        setHourlyData(hourlyDistribution);
      }
    } catch (error) {
      console.error("Error fetching meetings data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMonthlyTrends = (meetings: any[]) => {
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const trendsMap: Record<string, { total: number; completed: number; cancelled: number }> = {};

    meetings.forEach((meeting) => {
      const date = new Date(meeting.scheduled_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      if (!trendsMap[key]) {
        trendsMap[key] = { total: 0, completed: 0, cancelled: 0 };
      }

      trendsMap[key].total++;
      if (meeting.status === "Concluída") trendsMap[key].completed++;
      if (meeting.status === "Cancelada") trendsMap[key].cancelled++;
    });

    return Object.entries(trendsMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => {
        const [year, month] = key.split("-");
        return {
          month: `${monthNames[parseInt(month) - 1]}/${year.slice(2)}`,
          ...value,
        };
      });
  };

  const calculateTypeDistribution = (meetings: any[]) => {
    const types: Record<string, number> = {};
    meetings.forEach((m) => {
      types[m.type] = (types[m.type] || 0) + 1;
    });
    return Object.entries(types).map(([name, value]) => ({ name, value }));
  };

  const calculateStatusDistribution = (meetings: any[]) => {
    const statuses: Record<string, number> = {};
    meetings.forEach((m) => {
      statuses[m.status] = (statuses[m.status] || 0) + 1;
    });
    return Object.entries(statuses).map(([name, value]) => ({ name, value }));
  };

  const calculateHourlyDistribution = (meetings: any[]) => {
    const hours: Record<number, number> = {};
    for (let i = 7; i <= 20; i++) hours[i] = 0;

    meetings.forEach((m) => {
      const hour = new Date(m.scheduled_at).getHours();
      if (hours[hour] !== undefined) hours[hour]++;
    });

    return Object.entries(hours).map(([hour, count]) => ({
      hour: `${hour}h`,
      count,
    }));
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
          <CardTitle className="text-lg">Tendência de Reuniões</CardTitle>
          <CardDescription>Evolução mensal</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="hsl(var(--primary))"
                  fill="url(#colorTotal)"
                  name="Total"
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stroke="hsl(var(--success))"
                  fill="hsl(var(--success))"
                  fillOpacity={0.2}
                  name="Concluídas"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-fade-in">
      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Tendência de Reuniões</CardTitle>
          <CardDescription>Total vs Concluídas por mês</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" />
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
                  dataKey="total"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  name="Total"
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

      {/* Type Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Tipo</CardTitle>
          <CardDescription>Reuniões por categoria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  dataKey="value"
                >
                  {typeData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
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

      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Status das Reuniões</CardTitle>
          <CardDescription>Distribuição por status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="value" name="Quantidade" radius={[0, 4, 4, 0]}>
                  {statusData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.name === "Concluída"
                          ? "hsl(var(--success))"
                          : entry.name === "Cancelada"
                          ? "hsl(var(--destructive))"
                          : "hsl(var(--primary))"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Hourly Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Horários Mais Frequentes</CardTitle>
          <CardDescription>Distribuição de reuniões por hora</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="count" name="Reuniões" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
