import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Plus, Calendar, AlertCircle, Pencil, Trash2 } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ECCardTaskForm } from "./ECCardTaskForm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ECCardTasksProps {
  cardId: string;
  recordId?: string;
}

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

interface Task {
  id: string;
  card_id: string;
  record_id: string | null;
  title: string;
  description: string | null;
  assignee_id: string | null;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignee?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
}

const priorityConfig: Record<TaskPriority, { label: string; color: string }> = {
  low: { label: 'Baixa', color: 'bg-muted text-muted-foreground' },
  medium: { label: 'Média', color: 'bg-blue-500/10 text-blue-600' },
  high: { label: 'Alta', color: 'bg-orange-500/10 text-orange-600' },
  critical: { label: 'Crítica', color: 'bg-destructive/10 text-destructive' },
};

const statusConfig: Record<TaskStatus, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-500/10 text-yellow-600' },
  in_progress: { label: 'Em Andamento', color: 'bg-blue-500/10 text-blue-600' },
  completed: { label: 'Concluída', color: 'bg-green-500/10 text-green-600' },
  cancelled: { label: 'Cancelada', color: 'bg-muted text-muted-foreground' },
};

export function ECCardTasks({ cardId, recordId }: ECCardTasksProps) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['ec-card-tasks', cardId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('ec_card_tasks')
        .select(`
          *,
          assignee:profiles!ec_card_tasks_assignee_id_fkey(id, first_name, last_name, avatar_url)
        `)
        .eq('card_id', cardId)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Task[];
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ taskId, currentStatus }: { taskId: string; currentStatus: TaskStatus }) => {
      const newStatus: TaskStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      const { error } = await supabase
        .from('ec_card_tasks')
        .update({ status: newStatus })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ec-card-tasks', cardId] });
      toast({ title: "Status atualizado" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('ec_card_tasks')
        .delete()
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ec-card-tasks', cardId] });
      toast({ title: "Tarefa excluída" });
      setDeleteTaskId(null);
    },
    onError: () => {
      toast({ title: "Erro ao excluir tarefa", variant: "destructive" });
    },
  });

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingTask(null);
  };

  const isOverdue = (dueDate: string | null, status: TaskStatus) => {
    if (!dueDate || status === 'completed' || status === 'cancelled') return false;
    return isPast(new Date(dueDate)) && !isToday(new Date(dueDate));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const pendingCount = tasks?.filter(t => t.status === 'pending' || t.status === 'in_progress').length || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="in_progress">Em Andamento</SelectItem>
              <SelectItem value="completed">Concluídas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
          {pendingCount > 0 && (
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">
              {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <Button onClick={() => setFormOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nova Tarefa
        </Button>
      </div>

      {tasks?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Nenhuma tarefa encontrada</p>
          <p className="text-sm mt-1">Clique em "Nova Tarefa" para adicionar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks?.map((task) => (
            <div
              key={task.id}
              className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                task.status === 'completed' ? 'bg-muted/50' : 'bg-card hover:bg-accent/50'
              }`}
            >
              <Checkbox
                checked={task.status === 'completed'}
                onCheckedChange={() => toggleStatusMutation.mutate({ 
                  taskId: task.id, 
                  currentStatus: task.status 
                })}
                className="mt-1"
              />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className={`font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {task.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEditTask(task)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTaskId(task.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <Badge className={priorityConfig[task.priority].color}>
                    {priorityConfig[task.priority].label}
                  </Badge>
                  
                  <Badge className={statusConfig[task.status].color}>
                    {statusConfig[task.status].label}
                  </Badge>

                  {task.due_date && (
                    <div className={`flex items-center gap-1 text-sm ${
                      isOverdue(task.due_date, task.status) ? 'text-destructive' : 'text-muted-foreground'
                    }`}>
                      {isOverdue(task.due_date, task.status) && <AlertCircle className="h-3 w-3" />}
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(task.due_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                    </div>
                  )}

                  {task.assignee && (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={task.assignee.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {task.assignee.first_name?.[0]}{task.assignee.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground">
                        {task.assignee.first_name} {task.assignee.last_name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ECCardTaskForm
        open={formOpen}
        onOpenChange={handleCloseForm}
        cardId={cardId}
        recordId={recordId}
        task={editingTask}
      />

      <AlertDialog open={!!deleteTaskId} onOpenChange={() => setDeleteTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A tarefa será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTaskId && deleteMutation.mutate(deleteTaskId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
