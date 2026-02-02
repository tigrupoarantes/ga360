import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/external-client";
import { DateRange } from "./AnalyticsFilters";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Loader2, Users, UserCheck, UserX, TrendingUp } from "lucide-react";

interface ParticipationAnalyticsProps {
  dateRange: DateRange;
  companyId: string | null;
  areaId: string | null;
  compact?: boolean;
}

interface TopParticipant {
  id: string;
  name: string;
  avatar: string | null;
  meetings: number;
  attended: number;
  rate: number;
}

export function ParticipationAnalytics({ dateRange, companyId, areaId, compact }: ParticipationAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [overallStats, setOverallStats] = useState({ total: 0, attended: 0, rate: 0 });
  const [confirmationData, setConfirmationData] = useState<any[]>([]);
  const [topParticipants, setTopParticipants] = useState<TopParticipant[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);

  useEffect(() => {
    fetchParticipationData();
  }, [dateRange, companyId, areaId]);

  const fetchParticipationData = async () => {
    setLoading(true);
    try {
      // Fetch meetings in date range
      let meetingsQuery = supabase
        .from("meetings")
        .select("id, scheduled_at, area_id")
        .gte("scheduled_at", dateRange.from.toISOString())
        .lte("scheduled_at", dateRange.to.toISOString());

      if (areaId) meetingsQuery = meetingsQuery.eq("area_id", areaId);

      const { data: meetings } = await meetingsQuery;
      const meetingIds = meetings?.map((m) => m.id) || [];

      if (meetingIds.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch participants
      const { data: participants } = await supabase
        .from("meeting_participants")
        .select("id, user_id, attended, confirmation_status, meeting_id")
        .in("meeting_id", meetingIds);

      // Fetch profiles for names
      const userIds = [...new Set(participants?.map((p) => p.user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]));

      if (participants) {
        // Overall stats
        const total = participants.length;
        const attended = participants.filter((p) => p.attended).length;
        setOverallStats({ total, attended, rate: total > 0 ? (attended / total) * 100 : 0 });

        // Confirmation status distribution
        const confirmations: Record<string, number> = {
          confirmed: 0,
          declined: 0,
          pending: 0,
        };
        participants.forEach((p) => {
          const status = p.confirmation_status || "pending";
          confirmations[status] = (confirmations[status] || 0) + 1;
        });
        setConfirmationData([
          { name: "Confirmados", value: confirmations.confirmed, fill: "hsl(var(--success))" },
          { name: "Recusados", value: confirmations.declined, fill: "hsl(var(--destructive))" },
          { name: "Pendentes", value: confirmations.pending, fill: "hsl(var(--warning))" },
        ].filter((d) => d.value > 0));

        // Top participants by attendance
        const participantStats: Record<string, { meetings: number; attended: number }> = {};
        participants.forEach((p) => {
          if (!participantStats[p.user_id]) {
            participantStats[p.user_id] = { meetings: 0, attended: 0 };
          }
          participantStats[p.user_id].meetings++;
          if (p.attended) participantStats[p.user_id].attended++;
        });

        const topList = Object.entries(participantStats)
          .map(([userId, stats]) => {
            const profile = profileMap.get(userId);
            return {
              id: userId,
              name: profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "Usuário",
              avatar: profile?.avatar_url,
              meetings: stats.meetings,
              attended: stats.attended,
              rate: (stats.attended / stats.meetings) * 100,
            };
          })
          .sort((a, b) => b.meetings - a.meetings)
          .slice(0, 10);
        setTopParticipants(topList);

        // Monthly trend
        const monthlyTrend = calculateMonthlyTrend(participants, meetings || []);
        setTrendData(monthlyTrend);
      }
    } catch (error) {
      console.error("Error fetching participation data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMonthlyTrend = (participants: any[], meetings: any[]) => {
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const meetingMonthMap = new Map(
      meetings.map((m) => [m.id, new Date(m.scheduled_at)])
    );

    const trendsMap: Record<string, { total: number; attended: number }> = {};

    participants.forEach((p) => {
      const meetingDate = meetingMonthMap.get(p.meeting_id);
      if (!meetingDate) return;

      const key = `${meetingDate.getFullYear()}-${String(meetingDate.getMonth() + 1).padStart(2, "0")}`;
      if (!trendsMap[key]) {
        trendsMap[key] = { total: 0, attended: 0 };
      }
      trendsMap[key].total++;
      if (p.attended) trendsMap[key].attended++;
    });

    return Object.entries(trendsMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => {
        const [year, month] = key.split("-");
        return {
          month: `${monthNames[parseInt(month) - 1]}/${year.slice(2)}`,
          total: value.total,
          attended: value.attended,
          rate: value.total > 0 ? (value.attended / value.total) * 100 : 0,
        };
      });
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

  if (overallStats.total === 0) {
    return (
      <Card className={compact ? "" : "col-span-full"}>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mb-4 opacity-50" />
          <p>Nenhum dado de participação encontrado</p>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="text-lg">Taxa de Participação</CardTitle>
          <CardDescription>{overallStats.attended} de {overallStats.total} presenças</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={confirmationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {confirmationData.map((entry, index) => (
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
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-fade-in">
      {/* Overall Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Visão Geral de Participação</CardTitle>
          <CardDescription>Estatísticas consolidadas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold">{overallStats.total}</div>
              <div className="text-xs text-muted-foreground">Convites</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <UserCheck className="h-8 w-8 mx-auto mb-2 text-success" />
              <div className="text-2xl font-bold">{overallStats.attended}</div>
              <div className="text-xs text-muted-foreground">Presenças</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-info" />
              <div className="text-2xl font-bold">{overallStats.rate.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">Taxa</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Status de Confirmação</CardTitle>
          <CardDescription>Distribuição de confirmações</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={confirmationData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  dataKey="value"
                >
                  {confirmationData.map((entry, index) => (
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
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Tendência de Participação</CardTitle>
          <CardDescription>Evolução mensal da taxa de presença</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="total" name="Convites" fill="hsl(var(--primary))" />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="rate"
                  stroke="hsl(var(--success))"
                  strokeWidth={2}
                  name="Taxa (%)"
                  dot={{ fill: "hsl(var(--success))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top Participants */}
      <Card>
        <CardHeader>
          <CardTitle>Participantes Mais Ativos</CardTitle>
          <CardDescription>Top 10 por número de reuniões</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {topParticipants.map((participant, index) => (
              <div
                key={participant.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-fast"
              >
                <span className="text-sm font-medium text-muted-foreground w-6">
                  {index + 1}.
                </span>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={participant.avatar || undefined} />
                  <AvatarFallback className="text-xs">
                    {participant.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{participant.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {participant.attended}/{participant.meetings} reuniões
                  </p>
                </div>
                <Badge
                  variant={participant.rate >= 80 ? "default" : participant.rate >= 50 ? "secondary" : "destructive"}
                >
                  {participant.rate.toFixed(0)}%
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
