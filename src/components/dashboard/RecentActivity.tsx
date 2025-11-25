import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, ListTodo } from "lucide-react";

const activities = [
  {
    id: 1,
    type: 'meeting',
    title: 'Reunião Estratégica Q1',
    time: 'Hoje às 14:00',
    status: 'upcoming',
    icon: Users,
  },
  {
    id: 2,
    type: 'task',
    title: 'Revisar KPIs do Trade Marketing',
    time: 'Vence amanhã',
    status: 'pending',
    icon: ListTodo,
  },
  {
    id: 3,
    type: 'meeting',
    title: 'ATA Reunião Tática - Aprovação Pendente',
    time: 'Há 2 horas',
    status: 'pending',
    icon: Calendar,
  },
];

const statusConfig = {
  upcoming: { label: 'Próxima', variant: 'default' as const },
  pending: { label: 'Pendente', variant: 'secondary' as const },
  completed: { label: 'Concluída', variant: 'outline' as const },
};

export function RecentActivity() {
  return (
    <Card className="p-6 animate-fade-in-up">
      <h3 className="text-lg font-semibold text-foreground mb-4">Atividades Recentes</h3>
      <div className="space-y-4">
        {activities.map((activity) => {
          const Icon = activity.icon;
          const config = statusConfig[activity.status as keyof typeof statusConfig];
          
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
    </Card>
  );
}
