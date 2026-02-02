import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, ListTodo, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/external-client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Activity {
  id: string;
  type: 'meeting' | 'task' | 'ata';
  title: string;
  time: string;
  status: 'upcoming' | 'pending' | 'completed';
}

const statusConfig = {
  upcoming: { label: 'Próxima', variant: 'default' as const },
  pending: { label: 'Pendente', variant: 'secondary' as const },
  completed: { label: 'Concluída', variant: 'outline' as const },
};

const iconMap = {
  meeting: Users,
  task: ListTodo,
  ata: Calendar,
};

export function RecentActivity() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const now = new Date();
      const activitiesList: Activity[] = [];

      // Fetch upcoming meetings
      const { data: meetings } = await supabase
        .from('meetings')
        .select('id, title, scheduled_at, status')
        .gte('scheduled_at', now.toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(2);

      meetings?.forEach(meeting => {
        activitiesList.push({
          id: `meeting-${meeting.id}`,
          type: 'meeting',
          title: meeting.title,
          time: formatDistanceToNow(new Date(meeting.scheduled_at), { 
            addSuffix: true, 
            locale: ptBR 
          }),
          status: 'upcoming',
        });
      });

      // Fetch pending tasks
      const { data: tasks } = await supabase
        .from('meeting_tasks')
        .select('id, title, due_date, status')
        .eq('status', 'pending')
        .order('due_date', { ascending: true })
        .limit(2);

      tasks?.forEach(task => {
        activitiesList.push({
          id: `task-${task.id}`,
          type: 'task',
          title: task.title,
          time: task.due_date 
            ? `Vence ${formatDistanceToNow(new Date(task.due_date), { addSuffix: true, locale: ptBR })}`
            : 'Sem prazo',
          status: 'pending',
        });
      });

      // Fetch pending ATAs
      const { data: atas } = await supabase
        .from('meeting_atas')
        .select('id, meetings(title), status, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      atas?.forEach(ata => {
        const meeting = ata.meetings as { title: string } | null;
        activitiesList.push({
          id: `ata-${ata.id}`,
          type: 'ata',
          title: `ATA ${meeting?.title || 'Reunião'} - Aprovação Pendente`,
          time: formatDistanceToNow(new Date(ata.created_at), { 
            addSuffix: true, 
            locale: ptBR 
          }),
          status: 'pending',
        });
      });

      // Sort by time relevance and limit to 5
      setActivities(activitiesList.slice(0, 5));
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 animate-fade-in-up">
        <h3 className="text-lg font-semibold text-foreground mb-4">Atividades Recentes</h3>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 animate-fade-in-up">
      <h3 className="text-lg font-semibold text-foreground mb-4">Atividades Recentes</h3>
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Nenhuma atividade recente</p>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => {
            const Icon = iconMap[activity.type];
            const config = statusConfig[activity.status];
            
            return (
              <div 
                key={activity.id} 
                className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-fast cursor-pointer"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {activity.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activity.time}
                  </p>
                </div>
                <Badge variant={config.variant}>
                  {config.label}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
