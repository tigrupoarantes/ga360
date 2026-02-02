import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ChevronDown, ChevronRight, Settings2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ChecklistItem {
  id: string;
  text: string;
  required: boolean;
}

const formSchema = z.object({
  area_id: z.string().min(1, 'Área é obrigatória'),
  title: z.string().min(1, 'Título é obrigatório').max(100, 'Máximo 100 caracteres'),
  description: z.string().max(500, 'Máximo 500 caracteres').optional(),
  periodicity_type: z.string().min(1, 'Periodicidade é obrigatória'),
  responsible_id: z.string().optional(),
  backup_id: z.string().optional(),
  risk_days_threshold: z.coerce.number().min(1).max(30).default(3),
});

type FormData = z.infer<typeof formSchema>;

interface ECCardFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: any;
  areas: any[];
  defaultAreaId?: string;
}

const periodicityOptions = [
  { value: 'daily', label: 'Diário', description: 'Todo dia' },
  { value: 'weekly', label: 'Semanal', description: 'Uma vez por semana' },
  { value: 'biweekly', label: 'Quinzenal', description: 'A cada 15 dias' },
  { value: 'monthly', label: 'Mensal', description: 'Uma vez por mês' },
  { value: 'quarterly', label: 'Trimestral', description: 'A cada 3 meses' },
  { value: 'semiannual', label: 'Semestral', description: 'A cada 6 meses' },
  { value: 'annual', label: 'Anual', description: 'Uma vez por ano' },
  { value: 'manual_trigger', label: 'Sob demanda', description: 'Quando necessário' },
];

export function ECCardForm({ 
  open, 
  onOpenChange, 
  card,
  areas,
  defaultAreaId
}: ECCardFormProps) {
  const queryClient = useQueryClient();
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [newItemText, setNewItemText] = useState('');

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
      });
      
      // Parse checklist from existing card
      const existingChecklist = card.checklist_template_json || [];
      if (Array.isArray(existingChecklist)) {
        setChecklistItems(existingChecklist.map((item: any, index: number) => ({
          id: item.id || `item-${index + 1}`,
          text: item.text || '',
          required: item.required || false,
        })));
      }
      
      // Open advanced section if card has checklist or custom backup
      if (existingChecklist.length > 0 || card.backup_id) {
        setIsAdvancedOpen(true);
      }
    } else {
      form.reset({
        area_id: defaultAreaId || '',
        title: '',
        description: '',
        periodicity_type: 'monthly',
        responsible_id: '',
        backup_id: '',
        risk_days_threshold: 3,
      });
      setChecklistItems([]);
      setIsAdvancedOpen(false);
    }
  }, [card, form, defaultAreaId, open]);

  const addChecklistItem = () => {
    if (newItemText.trim()) {
      setChecklistItems([
        ...checklistItems,
        {
          id: `item-${Date.now()}`,
          text: newItemText.trim(),
          required: false,
        },
      ]);
      setNewItemText('');
    }
  };

  const removeChecklistItem = (id: string) => {
    setChecklistItems(checklistItems.filter((item) => item.id !== id));
  };

  const toggleItemRequired = (id: string) => {
    setChecklistItems(
      checklistItems.map((item) =>
        item.id === id ? { ...item, required: !item.required } : item
      )
    );
  };

  const updateItemText = (id: string, text: string) => {
    setChecklistItems(
      checklistItems.map((item) =>
        item.id === id ? { ...item, text } : item
      )
    );
  };

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Convert checklist items to JSON format
      const checklistJson = checklistItems
        .filter((item) => item.text.trim())
        .map((item, index) => ({
          id: `item-${index + 1}`,
          text: item.text.trim(),
          required: item.required,
        }));

      const payload = {
        area_id: data.area_id,
        title: data.title,
        description: data.description || null,
        periodicity_type: data.periodicity_type,
        responsible_id: data.responsible_id || null,
        backup_id: data.backup_id || null,
        risk_days_threshold: data.risk_days_threshold,
        checklist_template_json: checklistJson,
        // Use defaults for advanced JSON fields
        manual_fields_schema_json: card?.manual_fields_schema_json || [],
        due_rule_json: card?.due_rule_json || {},
        required_evidences_json: card?.required_evidences_json || [],
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
      <DialogContent className="max-w-xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {card ? 'Editar Card' : 'Novo Card'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
              {/* Essential Fields */}
              {!defaultAreaId && (
                <FormField
                  control={form.control}
                  name="area_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Área *</FormLabel>
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
                    <FormLabel>Título *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Orçamento Mensal" {...field} />
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
                        placeholder="Descreva brevemente o objetivo deste card" 
                        rows={2}
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
                  name="periodicity_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Periodicidade *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {periodicityOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex flex-col">
                                <span>{option.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        {periodicityOptions.find(o => o.value === field.value)?.description}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
              </div>

              {/* Advanced Settings - Collapsible */}
              <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="w-full justify-between px-3 py-2 h-auto text-muted-foreground hover:text-foreground"
                  >
                    <div className="flex items-center gap-2">
                      <Settings2 className="h-4 w-4" />
                      <span className="text-sm">Configurações avançadas</span>
                      <span className="text-xs text-muted-foreground">(opcional)</span>
                    </div>
                    {isAdvancedOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
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
                          <FormDescription className="text-xs">
                            Pessoa substituta caso o responsável não esteja disponível
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="risk_days_threshold"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dias para alerta</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} max={30} {...field} />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Dias antes do vencimento para alertar
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Checklist UI */}
                  <div className="space-y-3">
                    <div>
                      <FormLabel>Itens do Checklist</FormLabel>
                      <p className="text-xs text-muted-foreground mt-1">
                        Defina etapas que devem ser verificadas ao completar o card
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Input
                        placeholder="Digite um item do checklist"
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addChecklistItem();
                          }
                        }}
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="icon"
                        onClick={addChecklistItem}
                        disabled={!newItemText.trim()}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {checklistItems.length > 0 && (
                      <div className="space-y-2 rounded-md border p-3">
                        {checklistItems.map((item, index) => (
                          <div 
                            key={item.id} 
                            className="flex items-center gap-2 group"
                          >
                            <span className="text-xs text-muted-foreground w-5">
                              {index + 1}.
                            </span>
                            <Input
                              value={item.text}
                              onChange={(e) => updateItemText(item.id, e.target.value)}
                              className="flex-1 h-8 text-sm"
                            />
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                                <Checkbox
                                  checked={item.required}
                                  onCheckedChange={() => toggleItemRequired(item.id)}
                                />
                                Obrigatório
                              </label>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeChecklistItem(item.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {card ? 'Salvar' : 'Criar Card'}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
