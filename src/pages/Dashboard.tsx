import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp,
  Calendar,
  Target,
  Loader2
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { format, startOfMonth, endOfMonth, isAfter, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface DashboardStats {
  meetingsThisMonth: number;
  meetingsCompleted: number;
  tasksCompleted: number;
  tasksTotal: number;
  tasksOverdue: number;
  goalsAchieved: number;
  goalsTotal: number;
}

interface UpcomingMeeting {
  id: string;
  title: string;
  scheduled_at: string;
  areas?: { name: string } | null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    meetingsThisMonth: 0,
    meetingsCompleted: 0,
    tasksCompleted: 0,
    tasksTotal: 0,
    tasksOverdue: 0,
    goalsAchieved: 0,
    goalsTotal: 0,
  });
  const [upcomingMeetings, setUpcomingMeetings] = useState<UpcomingMeeting[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedCompanyId]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      // Fetch meetings this month
      let meetingsQuery = supabase
        .from('meetings')
        .select('id, status, scheduled_at')
        .gte('scheduled_at', monthStart.toISOString())
        .lte('scheduled_at', monthEnd.toISOString());

      const { data: meetingsData } = await meetingsQuery;

      const meetingsThisMonth = meetingsData?.length || 0;
      const meetingsCompleted = meetingsData?.filter(m => m.status === 'Finalizada').length || 0;

      // Fetch upcoming meetings
      let upcomingQuery = supabase
        .from('meetings')
        .select('id, title, scheduled_at, areas(name)')
        .gte('scheduled_at', now.toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(3);

      const { data: upcomingData } = await upcomingQuery;
      setUpcomingMeetings(upcomingData || []);

      // Fetch tasks stats
      const { data: tasksData } = await supabase
        .from('meeting_tasks')
        .select('id, status, due_date');

      const tasksTotal = tasksData?.length || 0;
      const tasksCompleted = tasksData?.filter(t => t.status === 'completed').length || 0;
      const tasksOverdue = tasksData?.filter(t => {
        if (t.status === 'completed' || t.status === 'cancelled') return false;
        if (!t.due_date) return false;
        return isBefore(new Date(t.due_date), now);
      }).length || 0;

      // Fetch goals stats
      let goalsQuery = supabase
        .from('goals')
        .select('id, current_value, target_value');

      if (selectedCompanyId) {
        goalsQuery = goalsQuery.eq('company_id', selectedCompanyId);
      }

      const { data: goalsData } = await goalsQuery;

      const goalsTotal = goalsData?.length || 0;
      const goalsAchieved = goalsData?.filter(g => 
        (g.current_value || 0) >= g.target_value
      ).length || 0;

      setStats({
        meetingsThisMonth,
        meetingsCompleted,
        tasksCompleted,
        tasksTotal,
        tasksOverdue,
        goalsAchieved,
        goalsTotal,
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatMeetingDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    if (isToday) return `Hoje, ${format(date, 'HH:mm')}`;
    if (isTomorrow) return `Amanhã, ${format(date, 'HH:mm')}`;
    return format(date, "EEE, HH:mm", { locale: ptBR });
  };

  const completionRate = stats.tasksTotal > 0 
    ? Math.round((stats.tasksCompleted / stats.tasksTotal) * 100) 
    : 0;

  const goalCompletionRate = stats.goalsTotal > 0
    ? Math.round((stats.goalsAchieved / stats.goalsTotal) * 100)
    : 0;

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold text-foreground">Dashboard Executivo</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral do planejamento estratégico e execução operacional
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Reuniões do Mês"
            value={stats.meetingsThisMonth}
            description={`${stats.meetingsCompleted} concluídas`}
            icon={Users}
            variant="primary"
          />
          <StatsCard
            title="Tarefas Concluídas"
            value={stats.tasksCompleted}
            description={`${completionRate}% do total`}
            icon={CheckCircle2}
            variant="secondary"
          />
          <StatsCard
            title="Tarefas Atrasadas"
            value={stats.tasksOverdue}
            description={stats.tasksOverdue > 0 ? "Requer atenção" : "Tudo em dia"}
            icon={AlertCircle}
            variant="accent"
          />
          <StatsCard
            title="Metas Atingidas"
            value={`${goalCompletionRate}%`}
            description={`${stats.goalsAchieved} de ${stats.goalsTotal} metas`}
            icon={Target}
            variant="primary"
          />
        </div>

        {/* Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* KPIs Chart Placeholder */}
          <Card className="lg:col-span-2 p-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground">Progresso por Pilar</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Último trimestre</span>
              </div>
            </div>
            <div className="flex items-center justify-center h-64 bg-muted/30 rounded-lg">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Gráficos de KPI em desenvolvimento</p>
              </div>
            </div>
          </Card>

          {/* Recent Activity */}
          <RecentActivity />
        </div>

        {/* Bottom Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Próximas Reuniões */}
          <Card className="p-6 animate-fade-in-up">
            <h3 className="text-lg font-semibold text-foreground mb-4">Próximas Reuniões</h3>
            {upcomingMeetings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nenhuma reunião agendada</p>
            ) : (
              <div className="space-y-3">
                {upcomingMeetings.map((meeting) => (
                  <div 
                    key={meeting.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-fast cursor-pointer"
                    onClick={() => navigate(`/reunioes/${meeting.id}/executar`)}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
                      <Users className="h-5 w-5 text-secondary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {meeting.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatMeetingDate(meeting.scheduled_at)} {meeting.areas?.name ? `• ${meeting.areas.name}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* MCI Radar */}
          <Card className="p-6 animate-fade-in-up">
            <h3 className="text-lg font-semibold text-foreground mb-4">MCI - Indicador Consolidado</h3>
            <div className="flex flex-col items-center justify-center h-48">
              <div className="relative">
                <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent">
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-card">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-primary">{goalCompletionRate}</p>
                      <p className="text-xs text-muted-foreground">MCI</p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Meta: 85 • {goalCompletionRate >= 85 ? 'Acima da expectativa' : 'Abaixo da meta'}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
