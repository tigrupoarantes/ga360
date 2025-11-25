import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Calendar, User } from "lucide-react";

const tasks = [
  {
    id: 1,
    title: 'Revisar e aprovar ATA da reunião estratégica Q1',
    assignee: 'João Silva',
    area: 'Diretoria',
    dueDate: '2024-01-15',
    priority: 'Alta',
    status: 'Pendente',
    linkedTo: { type: 'meeting', name: 'Reunião Estratégica Q1' }
  },
  {
    id: 2,
    title: 'Analisar KPIs de Trade Marketing do último mês',
    assignee: 'Maria Santos',
    area: 'Trade',
    dueDate: '2024-01-16',
    priority: 'Alta',
    status: 'Em Andamento',
    linkedTo: { type: 'process', name: 'Review Mensal KPIs' }
  },
  {
    id: 3,
    title: 'Preparar apresentação de resultados para diretoria',
    assignee: 'Carlos Oliveira',
    area: 'Comercial',
    dueDate: '2024-01-18',
    priority: 'Média',
    status: 'Pendente',
    linkedTo: null
  },
  {
    id: 4,
    title: 'Executar auditoria em 5 lojas da região Sul',
    assignee: 'Ana Costa',
    area: 'Trade',
    dueDate: '2024-01-20',
    priority: 'Alta',
    status: 'Pendente',
    linkedTo: { type: 'trade', name: 'Auditoria Regional' }
  },
];

const priorityColors = {
  'Alta': 'bg-destructive text-destructive-foreground',
  'Média': 'bg-accent text-accent-foreground',
  'Baixa': 'bg-muted text-muted-foreground',
  'Crítica': 'bg-destructive text-destructive-foreground font-bold',
};

const statusColors = {
  'Pendente': 'bg-muted text-muted-foreground',
  'Em Andamento': 'bg-info text-info-foreground',
  'Concluída': 'bg-success text-success-foreground',
  'Atrasada': 'bg-destructive text-destructive-foreground',
};

export default function Tasks() {
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Tarefas</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie e acompanhe todas as tarefas do planejamento
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Tarefa
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 animate-fade-in-up">
          {[
            { label: 'Total', value: '156', color: 'text-foreground' },
            { label: 'Pendentes', value: '42', color: 'text-muted-foreground' },
            { label: 'Em Andamento', value: '28', color: 'text-info' },
            { label: 'Atrasadas', value: '8', color: 'text-destructive' },
          ].map((stat) => (
            <Card key={stat.label} className="p-4">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="p-4 animate-fade-in-up">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[240px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar tarefas..."
                  className="pl-10"
                />
              </div>
            </div>
            <Button variant="outline">
              Status
            </Button>
            <Button variant="outline">
              Prioridade
            </Button>
            <Button variant="outline">
              Área
            </Button>
            <Button variant="outline">
              Responsável
            </Button>
          </div>
        </Card>

        {/* Tasks List */}
        <div className="space-y-3">
          {tasks.map((task) => (
            <Card 
              key={task.id}
              className="p-5 hover:shadow-card-hover transition-smooth cursor-pointer animate-fade-in-up"
            >
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center mt-1">
                  <div className="h-5 w-5 rounded border-2 border-muted-foreground hover:border-primary transition-fast" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-base font-semibold text-foreground">
                      {task.title}
                    </h3>
                    <div className="flex gap-2">
                      <Badge className={priorityColors[task.priority as keyof typeof priorityColors]}>
                        {task.priority}
                      </Badge>
                      <Badge className={statusColors[task.status as keyof typeof statusColors]}>
                        {task.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{task.assignee}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Vence em {new Date(task.dueDate).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <Badge variant="outline">{task.area}</Badge>
                    {task.linkedTo && (
                      <Badge variant="outline" className="text-primary border-primary/50">
                        Vinculada: {task.linkedTo.name}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
