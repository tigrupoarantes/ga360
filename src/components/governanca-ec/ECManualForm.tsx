import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Save, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface ManualFieldSchema {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'textarea' | 'checkbox' | 'select';
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

interface ECManualFormProps {
  card: any;
  record?: any;
}

import { useCardPermissions } from "@/hooks/useCardPermissions";

export function ECManualForm({ card, record }: ECManualFormProps) {
  const { user } = useAuth();
  const { hasCardPermission } = useCardPermissions();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({});

  const canEdit = hasCardPermission(card.id, 'fill') || hasCardPermission(card.id, 'manage');
  const manualFieldsSchema: ManualFieldSchema[] = card.manual_fields_schema_json || [];
  const checklistTemplate: { id: string; text: string; required?: boolean }[] = card.checklist_template_json || [];

  useEffect(() => {
    if (record?.manual_payload_json) {
      setFormData(record.manual_payload_json);
    }
    if (record?.checklist_json) {
      const checklistMap: Record<string, boolean> = {};
      record.checklist_json.forEach((item: any) => {
        checklistMap[item.id] = item.checked || false;
      });
      setChecklistState(checklistMap);
    }
  }, [record]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const checklistData = checklistTemplate.map(item => ({
        id: item.id,
        text: item.text,
        checked: checklistState[item.id] || false,
        required: item.required,
      }));

      if (record) {
        const { error } = await supabase
          .from('ec_card_records')
          .update({
            manual_payload_json: formData,
            checklist_json: checklistData,
            status: 'in_progress',
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.id);

        if (error) throw error;
      } else {
        const competence = format(new Date(), 'yyyy-MM');
        const { error } = await supabase
          .from('ec_card_records')
          .insert({
            card_id: card.id,
            competence,
            manual_payload_json: formData,
            checklist_json: checklistData,
            status: 'in_progress',
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Dados salvos com sucesso');
      queryClient.invalidateQueries({ queryKey: ['ec-card-records', card.id] });
    },
    onError: (error) => {
      toast.error('Erro ao salvar dados');
      console.error(error);
    },
  });

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleChecklistChange = (itemId: string, checked: boolean) => {
    setChecklistState(prev => ({ ...prev, [itemId]: checked }));
  };

  const renderField = (field: ManualFieldSchema) => {
    const value = formData[field.name] ?? '';

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            id={field.name}
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            disabled={!canEdit}
          />
        );
      case 'number':
        return (
          <Input
            id={field.name}
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            disabled={!canEdit}
          />
        );
      case 'date':
        return (
          <Input
            id={field.name}
            type="date"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            disabled={!canEdit}
          />
        );
      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.name}
              checked={!!value}
              onCheckedChange={(checked) => handleFieldChange(field.name, checked)}
              disabled={!canEdit}
            />
            <label htmlFor={field.name} className="text-sm">
              {field.placeholder || 'Sim'}
            </label>
          </div>
        );
      default:
        return (
          <Input
            id={field.name}
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            disabled={!canEdit}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {!canEdit && (
        <div className="bg-muted/50 p-4 rounded-md text-sm text-center text-muted-foreground">
          Modo visualização: Você não tem permissão para editar este card.
        </div>
      )}

      {/* Campos dinâmicos */}
      {manualFieldsSchema.length > 0 ? (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Campos do Card</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {manualFieldsSchema.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {renderField(field)}
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Campos do Card</h3>
          <p className="text-muted-foreground text-sm">
            Este card não possui campos manuais configurados.
            Acesse Admin &gt; Governança EC para configurar os campos.
          </p>
        </Card>
      )}

      {/* Checklist */}
      {checklistTemplate.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Checklist</h3>
          <div className="space-y-3">
            {checklistTemplate.map((item) => (
              <div key={item.id} className="flex items-start space-x-3">
                <Checkbox
                  id={`checklist-${item.id}`}
                  checked={checklistState[item.id] || false}
                  onCheckedChange={(checked) => handleChecklistChange(item.id, !!checked)}
                  disabled={!canEdit}
                />
                <label
                  htmlFor={`checklist-${item.id}`}
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {item.text}
                  {item.required && <span className="text-destructive ml-1">*</span>}
                </label>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Observações gerais */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Observações</h3>
        <Textarea
          value={formData.observations || ''}
          onChange={(e) => handleFieldChange('observations', e.target.value)}
          placeholder="Adicione observações relevantes sobre este período..."
          rows={4}
          disabled={!canEdit}
        />
      </Card>

      {/* Botão salvar */}
      {canEdit && (
        <div className="flex justify-end">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Atualização
          </Button>
        </div>
      )}
    </div>
  );
}
