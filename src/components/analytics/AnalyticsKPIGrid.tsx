import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "./AnalyticsFilters";
import {
  Calendar,
  CheckCircle,
  FileText,
  ListTodo,
  Users,
  Target,
  TrendingUp,
  TrendingDown,
  Clock,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalyticsKPIGridProps {
  dateRange: DateRange;
  companyId: string | null;
  areaId: string | null;
}

interface KPIData {
  totalMeetings: number;
  completedMeetings: number;
  meetingCompletionRate: number;
  totalTasks: number;
  completedTasks: number;
  taskCompletionRate: number;
  overdueTasks: number;
  totalGoals: number;
  goalsOnTrack: number;
  goalsAtRisk: number;
  avgGoalProgress: number;
  totalParticipants: number;
  avgParticipation: number;
  atasGenerated: number;
  previousPeriodMeetings: number;
  previousPeriodTasks: number;
}

export function AnalyticsKPIGrid({ dateRange, companyId, areaId }: AnalyticsKPIGridProps) {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIData>({
    totalMeetings: 0,
    completedMeetings: 0,
    meetingCompletionRate: 0,
    totalTasks: 0,
    completedTasks: 0,
    taskCompletionRate: 0,
    overdueTasks: 0,
    totalGoals: 0,
    goalsOnTrack: 0,
    goalsAtRisk: 0,
    avgGoalProgress: 0,
    totalParticipants: 0,
    avgParticipation: 0,
    atasGenerated: 0,
    previousPeriodMeetings: 0,
    previousPeriodTasks: 0,
  });

  useEffect(() => {
    fetchKPIs();
  }, [dateRange, companyId, areaId]);

  const fetchKPIs = async () => {
    setLoading(true);
    try {
      const fromDate = dateRange.from.toISOString();
      const toDate = dateRange.to.toISOString();

      // Calculate previous period for comparison
      const periodDays = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
      const prevFrom = new Date(dateRange.from.getTime() - periodDays * 24 * 60 * 60 * 1000);
      const prevTo = new Date(dateRange.from.getTime() - 1);

      // Fetch meetings
      let meetingsQuery = supabase
        .from("meetings")
        .select("id, status, area_id, scheduled_at")
        .gte("scheduled_at", fromDate)
        .lte("scheduled_at", toDate);

      if (areaId) meetingsQuery = meetingsQuery.eq("area_id", areaId);

      const { data: meetings } = await meetingsQuery;

      // Fetch previous period meetings for comparison
      let prevMeetingsQuery = supabase
        .from("meetings")
        .select("id")
        .gte("scheduled_at", prevFrom.toISOString())
        .lte("scheduled_at", prevTo.toISOString());

      if (areaId) prevMeetingsQuery = prevMeetingsQuery.eq("area_id", areaId);

      const { data: prevMeetings } = await prevMeetingsQuery;

      // Fetch tasks
      let tasksQuery = supabase
        .from("meeting_tasks")
        .select("id, status, due_date, created_at");

      const { data: tasks } = await tasksQuery;

      // Filter tasks by date range
      const filteredTasks = tasks?.filter((t) => {
        const taskDate = new Date(t.created_at);
        return taskDate >= dateRange.from && taskDate <= dateRange.to;
      });

      // Fetch participants
      const meetingIds = meetings?.map((m) => m.id) || [];
      let participantsData: any[] = [];
      if (meetingIds.length > 0) {
        const { data } = await supabase
          .from("meeting_participants")
          .select("id, attended, meeting_id")
          .in("meeting_id", meetingIds);
        participantsData = data || [];
      }

      // Fetch ATAs
      let atasData: any[] = [];
      if (meetingIds.length > 0) {
        const { data } = await supabase
          .from("meeting_atas")
          .select("id")
          .in("meeting_id", meetingIds);
        atasData = data || [];
      }

      // Fetch goals
      let goalsQuery = supabase
        .from("goals")
        .select("id, target_value, current_value, status")
        .eq("status", "active");

      if (companyId) goalsQuery = goalsQuery.eq("company_id", companyId);
      if (areaId) goalsQuery = goalsQuery.eq("area_id", areaId);

      const { data: goals } = await goalsQuery;

      // Calculate KPIs
      const totalMeetings = meetings?.length || 0;
      const completedMeetings = meetings?.filter((m) => m.status === "Concluída").length || 0;
      const meetingCompletionRate = totalMeetings > 0 ? (completedMeetings / totalMeetings) * 100 : 0;

      const totalTasks = filteredTasks?.length || 0;
      const completedTasks = filteredTasks?.filter((t) => t.status === "completed").length || 0;
      const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
      const overdueTasks = filteredTasks?.filter((t) => {
        if (!t.due_date) return false;
        return new Date(t.due_date) < new Date() && t.status !== "completed";
      }).length || 0;

      const totalGoals = goals?.length || 0;
      const goalsOnTrack = goals?.filter((g) => (g.current_value / g.target_value) >= 0.7).length || 0;
      const goalsAtRisk = goals?.filter((g) => (g.current_value / g.target_value) < 0.7).length || 0;
      const avgGoalProgress = totalGoals > 0
        ? goals.reduce((acc, g) => acc + (g.current_value / g.target_value) * 100, 0) / totalGoals
        : 0;

      const totalParticipants = participantsData.length;
      const attendedParticipants = participantsData.filter((p) => p.attended).length;
      const avgParticipation = totalParticipants > 0 ? (attendedParticipants / totalParticipants) * 100 : 0;

      setKpis({
        totalMeetings,
        completedMeetings,
        meetingCompletionRate,
        totalTasks,
        completedTasks,
        taskCompletionRate,
        overdueTasks,
        totalGoals,
        goalsOnTrack,
        goalsAtRisk,
        avgGoalProgress,
        totalParticipants,
        avgParticipation,
        atasGenerated: atasData.length,
        previousPeriodMeetings: prevMeetings?.length || 0,
        previousPeriodTasks: 0,
      });
    } catch (error) {
      console.error("Error fetching KPIs:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return { value: 0, isPositive: true };
    const change = ((current - previous) / previous) * 100;
    return { value: Math.abs(change), isPositive: change >= 0 };
  };

  const meetingTrend = calculateTrend(kpis.totalMeetings, kpis.previousPeriodMeetings);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
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

  const kpiCards = [
    {
      title: "Total de Reuniões",
      value: kpis.totalMeetings,
      subtitle: `${kpis.completedMeetings} concluídas`,
      icon: Calendar,
      trend: meetingTrend,
      color: "text-primary",
    },
    {
      title: "Taxa de Conclusão",
      value: `${kpis.meetingCompletionRate.toFixed(1)}%`,
      subtitle: "Reuniões finalizadas",
      icon: CheckCircle,
      color: "text-success",
    },
    {
      title: "Total de Tarefas",
      value: kpis.totalTasks,
      subtitle: `${kpis.completedTasks} concluídas`,
      icon: ListTodo,
      color: "text-info",
    },
    {
      title: "Tarefas Atrasadas",
      value: kpis.overdueTasks,
      subtitle: "Requer atenção",
      icon: Clock,
      color: kpis.overdueTasks > 0 ? "text-destructive" : "text-muted-foreground",
    },
    {
      title: "Total de Metas",
      value: kpis.totalGoals,
      subtitle: `${kpis.goalsOnTrack} no caminho`,
      icon: Target,
      color: "text-accent",
    },
    {
      title: "Progresso Médio",
      value: `${kpis.avgGoalProgress.toFixed(1)}%`,
      subtitle: "Das metas ativas",
      icon: TrendingUp,
      color: kpis.avgGoalProgress >= 70 ? "text-success" : "text-warning",
    },
    {
      title: "Participação Média",
      value: `${kpis.avgParticipation.toFixed(1)}%`,
      subtitle: `${kpis.totalParticipants} participantes`,
      icon: Users,
      color: "text-secondary-foreground",
    },
    {
      title: "ATAs Geradas",
      value: kpis.atasGenerated,
      subtitle: "Documentos criados",
      icon: FileText,
      color: "text-primary",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-fade-in">
      {kpiCards.map((kpi, index) => {
        const Icon = kpi.icon;
        return (
          <Card key={index} className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <Icon className={cn("h-4 w-4", kpi.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">{kpi.subtitle}</p>
                {kpi.trend && kpi.trend.value > 0 && (
                  <div
                    className={cn(
                      "flex items-center text-xs font-medium",
                      kpi.trend.isPositive ? "text-success" : "text-destructive"
                    )}
                  >
                    {kpi.trend.isPositive ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {kpi.trend.value.toFixed(0)}%
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
