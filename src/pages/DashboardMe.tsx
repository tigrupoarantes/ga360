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
  Calendar as CalendarIcon
} from "lucide-react";

const myTasks = [
  { id: 1, title: 'Revisar transcrição da reunião estratégica', priority: 'Alta', dueDate: 'Hoje' },
  { id: 2, title: 'Aprovar ATA da reunião tática', priority: 'Alta', dueDate: 'Hoje' },
  { id: 3, title: 'Preparar pauta para próxima reunião', priority: 'Média', dueDate: 'Amanhã' },
  { id: 4, title: 'Executar checklist do processo semanal', priority: 'Média', dueDate: '2 dias' },
];

const priorityColors = {
  'Alta': 'bg-destructive text-destructive-foreground',
  'Média': 'bg-accent text-accent-foreground',
  'Baixa': 'bg-muted text-muted-foreground',
};

export default function DashboardMe() {
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
            value="12"
            description="4 para hoje"
            icon={ListTodo}
            variant="primary"
          />
          <StatsCard
            title="Tarefas Concluídas"
            value="48"
            description="Este mês"
            icon={CheckCircle2}
            variant="secondary"
            trend={{ value: 15, isPositive: true }}
          />
          <StatsCard
            title="Reuniões Pendentes"
            value="3"
            description="2 com ATA pendente"
            icon={Clock}
            variant="accent"
          />
        </div>

        {/* Quick Actions */}
        <Card className="p-6 animate-fade-in-up">
          <h3 className="text-lg font-semibold text-foreground mb-4">Ações Rápidas</h3>
          <div className="flex flex-wrap gap-3">
            <Button variant="default" className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Tarefa
            </Button>
            <Button variant="outline" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              Agendar Reunião
            </Button>
            <Button variant="outline" className="gap-2">
              <ListTodo className="h-4 w-4" />
              Executar Processo
            </Button>
          </div>
        </Card>

        {/* My Tasks */}
        <Card className="p-6 animate-fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Minhas Tarefas Prioritárias</h3>
            <Button variant="ghost" size="sm">Ver todas</Button>
          </div>
          <div className="space-y-3">
            {myTasks.map((task) => (
              <div 
                key={task.id}
                className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 transition-fast cursor-pointer group"
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
                      Vence: {task.dueDate}
                    </span>
                  </div>
                </div>
                <Badge className={priorityColors[task.priority as keyof typeof priorityColors]}>
                  {task.priority}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Today's Schedule */}
        <Card className="p-6 animate-fade-in-up">
          <h3 className="text-lg font-semibold text-foreground mb-4">Agenda de Hoje</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex flex-col items-center justify-center min-w-[60px]">
                <span className="text-xs text-muted-foreground">14:00</span>
                <span className="text-xs text-muted-foreground">16:00</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Reunião Estratégica - Marketing Digital
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Com IA habilitada • Sala Virtual
                </p>
              </div>
              <Badge variant="default">Confirmada</Badge>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
