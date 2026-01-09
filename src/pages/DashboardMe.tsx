import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ListTodo, 
  Clock, 
  CheckCircle2,
  Plus,
  Calendar as CalendarIcon,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, isBefore, isToday, isTomorrow, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface MyTask {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  status: string;
}

interface TodayMeeting {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  ai_mode: string;
  confirmation_status?: string;
}

const priorityColors: Record<string, string> = {
  'critical': 'bg-destructive text-destructive-foreground',
  'high': 'bg-destructive text-destructive-foreground',
  'medium': 'bg-accent text-accent-foreground',
  'low': 'bg-muted text-muted-foreground',
};

const priorityLabels: Record<string, string> = {
  'critical': 'Crítica',
  'high': 'Alta',
  'medium': 'Média',
  'low': 'Baixa',
};

export default function DashboardMe() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myTasks, setMyTasks] = useState<MyTask[]>([]);
  const [todayMeetings, setTodayMeetings] = useState<TodayMeeting[]>([]);
  const [stats, setStats] = useState({
    totalTasks: 0,
    tasksForToday: 0,
    completedThisMonth: 0,
    pendingMeetings: 0,
    pendingAtas: 0,
  });

  useEffect(() => {
    if (user?.id) {
      fetchMyData();
    }
  }, [user?.id]);

  const fetchMyData = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      // Fetch my tasks
      const { data: tasksData } = await supabase
        .from('meeting_tasks')
        .select('id, title, priority, due_date, status')
        .eq('assignee_id', user?.id)
        .neq('status', 'cancelled')
        .order('due_date', { ascending: true });

      const tasks = tasksData || [];
      const pendingTasks = tasks.filter(t => t.status !== 'completed');
      
      // Priority tasks (high/critical and pending)
      const priorityTasks = pendingTasks
        .filter(t => ['high', 'critical'].includes(t.priority) || 
          (t.due_date && (isToday(new Date(t.due_date)) || isTomorrow(new Date(t.due_date)))))
        .slice(0, 4);

      setMyTasks(priorityTasks);

      // Calculate stats
      const tasksForToday = pendingTasks.filter(t => 
        t.due_date && isToday(new Date(t.due_date))
      ).length;

      const completedThisMonth = tasks.filter(t => 
        t.status === 'completed'
      ).length;

      // Fetch today's meetings where I'm a participant
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data: participationsData } = await supabase
        .from('meeting_participants')
        .select(`
          meeting_id,
          confirmation_status,
          meetings(id, title, scheduled_at, duration_minutes, ai_mode, status)
        `)
        .eq('user_id', user?.id);

      const todayMeetingsList: TodayMeeting[] = [];
      participationsData?.forEach(p => {
        const meeting = p.meetings as any;
        if (meeting && meeting.status !== 'Cancelada') {
          const meetingDate = new Date(meeting.scheduled_at);
          if (meetingDate >= todayStart && meetingDate <= todayEnd) {
            todayMeetingsList.push({
              id: meeting.id,
              title: meeting.title,
              scheduled_at: meeting.scheduled_at,
              duration_minutes: meeting.duration_minutes,
              ai_mode: meeting.ai_mode,
              confirmation_status: p.confirmation_status || undefined,
            });
          }
        }
      });

      // Sort by time
      todayMeetingsList.sort((a, b) => 
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      );

      setTodayMeetings(todayMeetingsList);

      // Pending ATAs count
      const { count: pendingAtasCount } = await supabase
        .from('meeting_atas')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      setStats({
        totalTasks: pendingTasks.length,
        tasksForToday,
        completedThisMonth,
        pendingMeetings: todayMeetingsList.length,
        pendingAtas: pendingAtasCount || 0,
      });

    } catch (error) {
      console.error('Error fetching my data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDueLabel = (dueDate: string | null) => {
    if (!dueDate) return 'Sem prazo';
    const date = new Date(dueDate);
    if (isToday(date)) return 'Hoje';
    if (isTomorrow(date)) return 'Amanhã';
    if (isBefore(date, new Date())) return 'Atrasada';
    return format(date, 'dd/MM', { locale: ptBR });
  };

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
          <h1 className="text-3xl font-bold text-foreground">Meu Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Suas tarefas, reuniões e responsabilidades
          </p>
        </div>

        {/* Personal Stats */}
        <div className="grid gap-6 md:grid-cols-3">
          <StatsCard
            title="Minhas Tarefas"
            value={stats.totalTasks}
            description={`${stats.tasksForToday} para hoje`}
            icon={ListTodo}
            variant="primary"
          />
          <StatsCard
            title="Concluídas este Mês"
            value={stats.completedThisMonth}
            description="Bom trabalho!"
            icon={CheckCircle2}
            variant="secondary"
          />
          <StatsCard
            title="Reuniões Hoje"
            value={stats.pendingMeetings}
            description={stats.pendingAtas > 0 ? `${stats.pendingAtas} ATA(s) pendente(s)` : 'Nenhuma ATA pendente'}
            icon={Clock}
            variant="accent"
          />
        </div>

        {/* Quick Actions */}
        <Card className="p-6 animate-fade-in-up">
          <h3 className="text-lg font-semibold text-foreground mb-4">Ações Rápidas</h3>
          <div className="flex flex-wrap gap-3">
            <Button variant="default" className="gap-2" onClick={() => navigate('/tarefas')}>
              <Plus className="h-4 w-4" />
              Ver Tarefas
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => navigate('/reunioes')}>
              <CalendarIcon className="h-4 w-4" />
              Agendar Reunião
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => navigate('/calendario')}>
              <ListTodo className="h-4 w-4" />
              Ver Calendário
            </Button>
          </div>
        </Card>

        {/* My Tasks */}
        <Card className="p-6 animate-fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Minhas Tarefas Prioritárias</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/tarefas')}>Ver todas</Button>
          </div>
          {myTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhuma tarefa prioritária no momento</p>
          ) : (
            <div className="space-y-3">
              {myTasks.map((task) => (
                <div 
                  key={task.id}
                  className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 transition-fast cursor-pointer group"
                  onClick={() => navigate('/tarefas')}
                >
                  <div className="flex items-center justify-center">
                    <div className="h-5 w-5 rounded border-2 border-muted-foreground group-hover:border-primary transition-fast" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        Vence: {getDueLabel(task.due_date)}
                      </span>
                    </div>
                  </div>
                  <Badge className={priorityColors[task.priority] || priorityColors.medium}>
                    {priorityLabels[task.priority] || task.priority}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Today's Schedule */}
        <Card className="p-6 animate-fade-in-up">
          <h3 className="text-lg font-semibold text-foreground mb-4">Agenda de Hoje</h3>
          {todayMeetings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhuma reunião agendada para hoje</p>
          ) : (
            <div className="space-y-4">
              {todayMeetings.map((meeting) => {
                const startTime = new Date(meeting.scheduled_at);
                const endTime = new Date(startTime.getTime() + meeting.duration_minutes * 60000);
                
                return (
                  <div 
                    key={meeting.id}
                    className="flex items-start gap-4 p-3 rounded-lg bg-primary/5 border border-primary/20 cursor-pointer hover:bg-primary/10 transition-fast"
                    onClick={() => navigate(`/reunioes/${meeting.id}/executar`)}
                  >
                    <div className="flex flex-col items-center justify-center min-w-[60px]">
                      <span className="text-xs text-muted-foreground">{format(startTime, 'HH:mm')}</span>
                      <span className="text-xs text-muted-foreground">{format(endTime, 'HH:mm')}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {meeting.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {meeting.ai_mode === 'full' ? 'Com IA habilitada' : 'Sem IA'} • Sala Virtual
                      </p>
                    </div>
                    <Badge variant={meeting.confirmation_status === 'confirmed' ? 'default' : 'secondary'}>
                      {meeting.confirmation_status === 'confirmed' ? 'Confirmada' : 'Pendente'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
