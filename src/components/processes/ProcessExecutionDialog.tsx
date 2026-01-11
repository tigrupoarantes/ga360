import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";

interface ChecklistItem {
  id: string;
  text: string;
  is_required: boolean;
  order_index: number;
}

interface ProcessExecutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  process: any | null;
  onSuccess: () => void;
}

export function ProcessExecutionDialog({ 
  open, 
  onOpenChange, 
  process, 
  onSuccess 
}: ProcessExecutionDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(null);

  useEffect(() => {
    if (!process || !open) return;

    const loadChecklistItems = async () => {
      const { data } = await supabase
        .from("process_checklist_items")
        .select("*")
        .eq("process_id", process.id)
        .order("order_index");
      
      if (data) {
        setChecklistItems(data);
      }
    };

    const startExecution = async () => {
      const { data, error } = await supabase
        .from("process_executions")
        .insert({
          process_id: process.id,
          executed_by: user?.id,
          status: "in_progress",
        })
        .select()
        .single();

      if (data) {
        setExecutionId(data.id);
      }
    };

    loadChecklistItems();
    startExecution();
    setCompletedItems(new Set());
    setNotes("");
  }, [process, open, user]);

  const toggleItem = (itemId: string) => {
    setCompletedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const requiredItems = checklistItems.filter(item => item.is_required);
  const allRequiredCompleted = requiredItems.every(item => completedItems.has(item.id));
  const progress = checklistItems.length > 0 
    ? (completedItems.size / checklistItems.length) * 100 
    : 0;

  const handleComplete = async () => {
    if (!executionId || !user) return;

    if (!allRequiredCompleted) {
      toast({
        title: "Itens obrigatórios pendentes",
        description: "Complete todos os itens obrigatórios antes de finalizar.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Update execution status
    const { error: execError } = await supabase
      .from("process_executions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        notes,
      })
      .eq("id", executionId);

    if (execError) {
      toast({ title: "Erro ao salvar", description: execError.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Save execution items
    const executionItems = checklistItems.map(item => ({
      execution_id: executionId,
      checklist_item_id: item.id,
      is_completed: completedItems.has(item.id),
      completed_at: completedItems.has(item.id) ? new Date().toISOString() : null,
      completed_by: completedItems.has(item.id) ? user.id : null,
    }));

    await supabase.from("process_execution_items").insert(executionItems);

    setLoading(false);
    toast({ title: "Processo executado com sucesso!" });
    onOpenChange(false);
    onSuccess();
  };

  const handleCancel = async () => {
    if (executionId) {
      await supabase
        .from("process_executions")
        .update({ status: "cancelled" })
        .eq("id", executionId);
    }
    onOpenChange(false);
  };

  if (!process) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleCancel();
    }}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Executar: {process.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>

          {checklistItems.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              <p>Este processo não possui itens de checklist.</p>
            </Card>
          ) : (
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {checklistItems.map(item => {
                  const isCompleted = completedItems.has(item.id);
                  
                  return (
                    <Card
                      key={item.id}
                      className={`p-3 cursor-pointer transition-colors ${
                        isCompleted ? 'bg-primary/10 border-primary/30' : ''
                      }`}
                      onClick={() => toggleItem(item.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isCompleted}
                          onCheckedChange={() => toggleItem(item.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <p className={`text-sm ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                            {item.text}
                          </p>
                          {item.is_required && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              Obrigatório
                            </Badge>
                          )}
                        </div>
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        ) : item.is_required ? (
                          <AlertCircle className="h-5 w-5 text-destructive" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Observações</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione observações sobre esta execução..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button 
              onClick={handleComplete} 
              disabled={loading || !allRequiredCompleted}
            >
              {loading ? "Salvando..." : "Concluir Execução"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
