import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
  due_date: z.date().optional().nullable(),
  assignee_id: z.string().optional().nullable(),
});

type FormData = z.infer<typeof formSchema>;

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    status: string;
    due_date: string | null;
    assignee_id: string | null;
    meeting_id: string;
  } | null;
  meetingId?: string;
  onSuccess?: () => void;
}

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  meetingId,
  onSuccess,
}: TaskFormDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'medium',
      status: 'pending',
      due_date: null,
      assignee_id: null,
    },
  });

  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        description: task.description || '',
        priority: task.priority as FormData['priority'],
        status: task.status as FormData['status'],
        due_date: task.due_date ? new Date(task.due_date) : null,
        assignee_id: task.assignee_id,
      });
    } else {
      form.reset({
        title: '',
        description: '',
        priority: 'medium',
        status: 'pending',
        due_date: null,
        assignee_id: null,
      });
    }
  }, [task, form]);

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('is_active', true);
      
      if (data) {
        setProfiles(data);
      }
    };

    if (open) {
      fetchProfiles();
    }
  }, [open]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const payload = {
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        status: data.status,
        due_date: data.due_date ? format(data.due_date, 'yyyy-MM-dd') : null,
        assignee_id: data.assignee_id || null,
        meeting_id: task?.meeting_id || meetingId,
      };

      if (task) {
        const { error } = await supabase
          .from('meeting_tasks')
          .update(payload)
          .eq('id', task.id);

        if (error) throw error;

        toast({
          title: 'Tarefa atualizada',
          description: 'A tarefa foi atualizada com sucesso.',
        });
      } else {
        if (!meetingId) {
          throw new Error('Meeting ID é obrigatório para criar uma tarefa');
        }

        const { error } = await supabase
          .from('meeting_tasks')
          .insert({ ...payload, meeting_id: meetingId });

        if (error) throw error;

        toast({
          title: 'Tarefa criada',
          description: 'A tarefa foi criada com sucesso.',
        });
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error saving task:', error);
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const priorityLabels = {
    low: 'Baixa',
    medium: 'Média',
    high: 'Alta',
    critical: 'Crítica',
  };

  const statusLabels = {
    pending: 'Pendente',
    in_progress: 'Em Andamento',
    completed: 'Concluída',
    cancelled: 'Cancelada',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{task ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
          <DialogDescription>
            {task ? 'Atualize os dados da tarefa' : 'Preencha os dados para criar uma nova tarefa'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Título da tarefa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descrição da tarefa"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridade</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(priorityLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Vencimento</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'dd/MM/yyyy', { locale: ptBR })
                            ) : (
                              <span>Selecione</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date('1900-01-01')}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assignee_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Não atribuído</SelectItem>
                        {profiles.map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.first_name} {profile.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {task ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
