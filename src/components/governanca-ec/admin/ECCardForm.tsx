import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const formSchema = z.object({
  area_id: z.string().min(1, 'Área é obrigatória'),
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  periodicity_type: z.string().min(1, 'Periodicidade é obrigatória'),
  responsible_id: z.string().optional(),
  backup_id: z.string().optional(),
  risk_days_threshold: z.coerce.number().min(1).max(30),
  due_rule_json: z.string().optional(),
  manual_fields_schema_json: z.string().optional(),
  checklist_template_json: z.string().optional(),
  required_evidences_json: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ECCardFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: any;
  areas: any[];
  defaultAreaId?: string;
}

export function ECCardForm({ 
  open, 
  onOpenChange, 
  card,
  areas,
  defaultAreaId
}: ECCardFormProps) {
  const queryClient = useQueryClient();

  const { data: profiles } = useQuery({
    queryKey: ['profiles-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('is_active', true)
        .order('first_name');
      
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      area_id: '',
      title: '',
      description: '',
      periodicity_type: 'monthly',
      responsible_id: '',
      backup_id: '',
      risk_days_threshold: 3,
      due_rule_json: '{}',
      manual_fields_schema_json: '[]',
      checklist_template_json: '[]',
      required_evidences_json: '[]',
    },
  });

  useEffect(() => {
    if (card) {
      form.reset({
        area_id: card.area_id,
        title: card.title,
        description: card.description || '',
        periodicity_type: card.periodicity_type,
        responsible_id: card.responsible_id || '',
        backup_id: card.backup_id || '',
        risk_days_threshold: card.risk_days_threshold || 3,
        due_rule_json: JSON.stringify(card.due_rule_json || {}, null, 2),
        manual_fields_schema_json: JSON.stringify(card.manual_fields_schema_json || [], null, 2),
        checklist_template_json: JSON.stringify(card.checklist_template_json || [], null, 2),
        required_evidences_json: JSON.stringify(card.required_evidences_json || [], null, 2),
      });
    } else {
      form.reset({
        area_id: defaultAreaId || '',
        title: '',
        description: '',
        periodicity_type: 'monthly',
        responsible_id: '',
        backup_id: '',
        risk_days_threshold: 3,
        due_rule_json: '{}',
        manual_fields_schema_json: '[]',
        checklist_template_json: '[]',
        required_evidences_json: '[]',
      });
    }
  }, [card, form, defaultAreaId]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      let dueRule = {};
      let manualFields = [];
      let checklist = [];
      let requiredEvidences = [];

      try {
        dueRule = JSON.parse(data.due_rule_json || '{}');
        manualFields = JSON.parse(data.manual_fields_schema_json || '[]');
        checklist = JSON.parse(data.checklist_template_json || '[]');
        requiredEvidences = JSON.parse(data.required_evidences_json || '[]');
      } catch (e) {
        throw new Error('JSON inválido');
      }

      const payload = {
        area_id: data.area_id,
        title: data.title,
        description: data.description,
        periodicity_type: data.periodicity_type,
        responsible_id: data.responsible_id || null,
        backup_id: data.backup_id || null,
        risk_days_threshold: data.risk_days_threshold,
        due_rule_json: dueRule,
        manual_fields_schema_json: manualFields,
        checklist_template_json: checklist,
        required_evidences_json: requiredEvidences,
      };

      if (card) {
        const { error } = await supabase
          .from('ec_cards')
          .update(payload)
          .eq('id', card.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ec_cards')
          .insert(payload);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(card ? 'Card atualizado' : 'Card criado');
      queryClient.invalidateQueries({ queryKey: ['ec-cards-admin'] });
      queryClient.invalidateQueries({ queryKey: ['ec-cards'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao salvar card');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {card ? 'Editar Card' : 'Novo Card'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
              {!defaultAreaId && (
                <FormField
                  control={form.control}
                  name="area_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Área</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a área" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {areas?.map((area) => (
                            <SelectItem key={area.id} value={area.id}>
                              {area.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input placeholder="Orçamento Mensal" {...field} />
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
                      <Textarea placeholder="Descrição do card" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="periodicity_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Periodicidade</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Diário</SelectItem>
                          <SelectItem value="weekly">Semanal</SelectItem>
                          <SelectItem value="biweekly">Quinzenal</SelectItem>
                          <SelectItem value="monthly">Mensal</SelectItem>
                          <SelectItem value="quarterly">Trimestral</SelectItem>
                          <SelectItem value="semiannual">Semestral</SelectItem>
                          <SelectItem value="annual">Anual</SelectItem>
                          <SelectItem value="manual_trigger">Manual</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="risk_days_threshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dias para "Em Risco"</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={30} {...field} />
                      </FormControl>
                      <FormDescription>
                        Quantos dias antes do vencimento
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="responsible_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsável</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {profiles?.map((profile) => (
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

                <FormField
                  control={form.control}
                  name="backup_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Backup</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {profiles?.map((profile) => (
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

              <FormField
                control={form.control}
                name="manual_fields_schema_json"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Campos Manuais (JSON)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder='[{"name": "valor", "label": "Valor", "type": "number", "required": true}]'
                        className="font-mono text-sm"
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Schema dos campos que o usuário preenche manualmente
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="checklist_template_json"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Checklist Template (JSON)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder='[{"id": "item1", "text": "Verificar valores", "required": true}]'
                        className="font-mono text-sm"
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {card ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
