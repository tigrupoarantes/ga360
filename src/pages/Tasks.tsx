import { useState, useEffect } from 'react';
import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Calendar, User, LinkIcon, Loader2, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/external-client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";

interface MeetingTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  assignee_id: string | null;
  meeting_id: string;
  created_at: string;
  meetings?: {
    title: string;
    scheduled_at: string;
  };
  profiles?: {
    first_name: string | null;
    last_name: string | null;
  };
}

interface TaskStats {
  total: number;
  pending: number;
  in_progress: number;
  overdue: number;
}

const priorityLabels: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  in_progress: 'Em Andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

const priorityColors: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-accent text-accent-foreground',
  high: 'bg-destructive text-destructive-foreground',
  critical: 'bg-destructive text-destructive-foreground font-bold',
};

const statusColors: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-info text-info-foreground',
  completed: 'bg-success text-success-foreground',
  cancelled: 'bg-muted text-muted-foreground',
};

export default function Tasks() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<MeetingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TaskStats>({ total: 0, pending: 0, in_progress: 0, overdue: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [editingTask, setEditingTask] = useState<MeetingTask | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      
      // Fetch tasks with meeting info
      let query = supabase
        .from('meeting_tasks')
        .select(`
          *,
          meetings (title, scheduled_at)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch profiles for assignees
      const assigneeIds = [...new Set((data || []).map(t => t.assignee_id).filter(Boolean))];
      let profilesMap = new Map<string, { first_name: string | null; last_name: string | null }>();
      
      if (assigneeIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', assigneeIds);
        
        profilesData?.forEach(p => {
          profilesMap.set(p.id, { first_name: p.first_name, last_name: p.last_name });
        });
      }

      // Map tasks with profile data
      const tasksData: MeetingTask[] = (data || []).map(task => ({
        ...task,
        profiles: task.assignee_id ? profilesMap.get(task.assignee_id) || undefined : undefined,
      }));
      
      // Apply search filter client-side
      const filteredTasks = searchTerm
        ? tasksData.filter(task => 
            task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.description?.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : tasksData;

      setTasks(filteredTasks);

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const allTasks = data || [];
      const statsData: TaskStats = {
        total: allTasks.length,
        pending: allTasks.filter(t => t.status === 'pending').length,
        in_progress: allTasks.filter(t => t.status === 'in_progress').length,
        overdue: allTasks.filter(t => {
          if (t.status === 'completed' || t.status === 'cancelled') return false;
          if (!t.due_date) return false;
          return new Date(t.due_date) < today;
        }).length,
      };
      setStats(statsData);

    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: 'Erro ao carregar tarefas',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [statusFilter, priorityFilter, searchTerm]);

  const handleToggleComplete = async (task: MeetingTask) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    
    try {
      const { error } = await supabase
        .from('meeting_tasks')
        .update({ status: newStatus })
        .eq('id', task.id);

      if (error) throw error;

      setTasks(prev => 
        prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t)
      );

      toast({
        title: newStatus === 'completed' ? 'Tarefa concluída' : 'Tarefa reaberta',
        description: task.title,
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: 'Erro ao atualizar tarefa',
        variant: 'destructive',
      });
    }
  };

  const handleEditTask = (task: MeetingTask) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const isOverdue = (task: MeetingTask) => {
    if (task.status === 'completed' || task.status === 'cancelled') return false;
    if (!task.due_date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(task.due_date) < today;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Tarefas</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie e acompanhe todas as tarefas geradas pelas reuniões
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 animate-fade-in-up">
          {[
            { label: 'Total', value: stats.total, color: 'text-foreground' },
            { label: 'Pendentes', value: stats.pending, color: 'text-muted-foreground' },
            { label: 'Em Andamento', value: stats.in_progress, color: 'text-info' },
            { label: 'Atrasadas', value: stats.overdue, color: 'text-destructive' },
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
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="in_progress">Em Andamento</SelectItem>
                <SelectItem value="completed">Concluída</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Prioridades</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="critical">Crítica</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Tasks List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : tasks.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">
              Nenhuma tarefa encontrada. As tarefas serão geradas automaticamente ao finalizar reuniões com transcrição.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <Card 
                key={task.id}
                className={`p-5 hover:shadow-card-hover transition-smooth animate-fade-in-up ${
                  isOverdue(task) ? 'border-destructive/50' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center mt-1">
                    <Checkbox
                      checked={task.status === 'completed'}
                      onCheckedChange={() => handleToggleComplete(task)}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className={`text-base font-semibold text-foreground ${
                        task.status === 'completed' ? 'line-through text-muted-foreground' : ''
                      }`}>
                        {task.title}
                      </h3>
                      <div className="flex gap-2 items-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditTask(task)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Badge className={priorityColors[task.priority] || priorityColors.medium}>
                          {priorityLabels[task.priority] || task.priority}
                        </Badge>
                        <Badge className={isOverdue(task) ? 'bg-destructive text-destructive-foreground' : statusColors[task.status] || statusColors.pending}>
                          {isOverdue(task) ? 'Atrasada' : (statusLabels[task.status] || task.status)}
                        </Badge>
                      </div>
                    </div>

                    {task.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                      {task.profiles && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>{task.profiles.first_name} {task.profiles.last_name}</span>
                        </div>
                      )}
                      {task.due_date && (
                        <div className={`flex items-center gap-2 ${isOverdue(task) ? 'text-destructive' : ''}`}>
                          <Calendar className="h-4 w-4" />
                          <span>Vence em {format(new Date(task.due_date), 'dd/MM/yyyy', { locale: ptBR })}</span>
                        </div>
                      )}
                      {task.meetings && (
                        <Badge variant="outline" className="text-primary border-primary/50">
                          <LinkIcon className="h-3 w-3 mr-1" />
                          {task.meetings.title}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        onSuccess={() => {
          fetchTasks();
          setEditingTask(null);
        }}
      />
    </MainLayout>
  );
}
