import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/external-client";
import { Edit, Save, X, CheckCircle, FileText, Sparkles, AlertCircle, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateAtaPDF } from "@/lib/pdfGenerator";

interface AtaViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
}

interface Ata {
  id: string;
  summary: string;
  decisions: string[];
  action_items: { task: string; responsible: string; deadline: string }[];
  content: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export function AtaViewer({ open, onOpenChange, meetingId }: AtaViewerProps) {
  const { toast } = useToast();
  const [ata, setAta] = useState<Ata | null>(null);
  const [meeting, setMeeting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [editedData, setEditedData] = useState({
    summary: "",
    decisions: [] as string[],
    action_items: [] as { task: string; responsible: string; deadline: string }[],
    content: "",
  });

  useEffect(() => {
    if (open && meetingId) {
      fetchAtaData();
    }
  }, [open, meetingId]);

  const fetchAtaData = async () => {
    setLoading(true);
    try {
      // Fetch meeting data
      const { data: meetingData, error: meetingError } = await supabase
        .from("meetings")
        .select("*, meeting_rooms(name), areas(name)")
        .eq("id", meetingId)
        .single();

      if (meetingError) throw meetingError;
      setMeeting(meetingData);

      // Fetch ATA
      const { data: ataData, error: ataError } = await supabase
        .from("meeting_atas")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (ataError) {
        if (ataError.code === "PGRST116") {
          toast({
            title: "ATA não encontrada",
            description: "Esta reunião ainda não possui uma ATA gerada.",
            variant: "destructive",
          });
          return;
        }
        throw ataError;
      }

      const processedAta: Ata = {
        ...ataData,
        decisions: (ataData.decisions as string[]) || [],
        action_items: (ataData.action_items as { task: string; responsible: string; deadline: string }[]) || [],
      };

      setAta(processedAta);
      setEditedData({
        summary: processedAta.summary || "",
        decisions: processedAta.decisions,
        action_items: processedAta.action_items,
        content: processedAta.content || "",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar ATA",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!ata) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("meeting_atas")
        .update({
          summary: editedData.summary,
          decisions: editedData.decisions,
          action_items: editedData.action_items,
          content: editedData.content,
        })
        .eq("id", ata.id);

      if (error) throw error;

      toast({
        title: "ATA salva",
        description: "As alterações foram salvas com sucesso.",
      });

      setEditing(false);
      fetchAtaData();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!ata) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("meeting_atas")
        .update({
          status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", ata.id);

      if (error) throw error;

      toast({
        title: "ATA aprovada",
        description: "A ATA foi aprovada com sucesso.",
      });

      fetchAtaData();
    } catch (error: any) {
      toast({
        title: "Erro ao aprovar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReject = () => {
    setEditing(true);
    toast({
      title: "Modo de edição ativado",
      description: "Faça as correções necessárias antes de salvar.",
    });
  };

  const addDecision = () => {
    setEditedData({
      ...editedData,
      decisions: [...editedData.decisions, ""],
    });
  };

  const updateDecision = (index: number, value: string) => {
    const newDecisions = [...editedData.decisions];
    newDecisions[index] = value;
    setEditedData({ ...editedData, decisions: newDecisions });
  };

  const removeDecision = (index: number) => {
    const newDecisions = editedData.decisions.filter((_, i) => i !== index);
    setEditedData({ ...editedData, decisions: newDecisions });
  };

  const addActionItem = () => {
    setEditedData({
      ...editedData,
      action_items: [
        ...editedData.action_items,
        { task: "", responsible: "", deadline: "" },
      ],
    });
  };

  const updateActionItem = (
    index: number,
    field: "task" | "responsible" | "deadline",
    value: string
  ) => {
    const newItems = [...editedData.action_items];
    newItems[index][field] = value;
    setEditedData({ ...editedData, action_items: newItems });
  };

  const removeActionItem = (index: number) => {
    const newItems = editedData.action_items.filter((_, i) => i !== index);
    setEditedData({ ...editedData, action_items: newItems });
  };

  const handleGeneratePDF = async () => {
    if (!ata || !meeting) return;

    try {
      await generateAtaPDF({
        meeting: {
          title: meeting.title,
          type: meeting.type,
          scheduled_at: meeting.scheduled_at,
          duration_minutes: meeting.duration_minutes,
          areas: meeting.areas,
          meeting_rooms: meeting.meeting_rooms,
        },
        ata: {
          summary: ata.summary,
          decisions: ata.decisions as string[],
          action_items: ata.action_items as { task: string; responsible: string; deadline: string }[],
          approved_at: ata.approved_at || undefined,
        },
      });

      toast({
        title: "PDF gerado com sucesso",
        description: "O PDF da ATA foi baixado.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao gerar PDF",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <Sparkles className="h-8 w-8 animate-pulse mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Carregando ATA...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!ata) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex flex-col items-center justify-center p-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">ATA não encontrada</p>
            <p className="text-muted-foreground text-center">
              Esta reunião ainda não possui uma ATA gerada pela IA.
            </p>
            <Button onClick={() => onOpenChange(false)} className="mt-4">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const statusBadgeConfig = {
    draft: { label: "Rascunho", variant: "secondary" as const },
    approved: { label: "Aprovada", variant: "default" as const },
    archived: { label: "Arquivada", variant: "outline" as const },
  };

  const statusConfig = statusBadgeConfig[ata.status as keyof typeof statusBadgeConfig] || 
                       statusBadgeConfig.draft;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl flex items-center gap-2">
                <FileText className="h-6 w-6" />
                ATA da Reunião
              </DialogTitle>
              {meeting && (
                <div className="mt-2 space-y-1">
                  <p className="text-base font-medium">{meeting.title}</p>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span>{meeting.type}</span>
                    {meeting.areas && <span>• {meeting.areas.name}</span>}
                    <span>
                      • {format(new Date(meeting.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <Badge variant={statusConfig.variant} className="shrink-0">
              {statusConfig.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* AI Generated Badge */}
          <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">
              Gerado por IA em {format(new Date(ata.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>

          {/* Summary Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumo Executivo</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <Textarea
                  value={editedData.summary}
                  onChange={(e) =>
                    setEditedData({ ...editedData, summary: e.target.value })
                  }
                  rows={6}
                  placeholder="Resumo da reunião..."
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{ata.summary}</p>
              )}
            </CardContent>
          </Card>

          {/* Decisions Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Decisões Tomadas</CardTitle>
              {editing && (
                <Button size="sm" variant="outline" onClick={addDecision}>
                  Adicionar
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {editing ? (
                  editedData.decisions.map((decision, index) => (
                    <div key={index} className="flex gap-2">
                      <Textarea
                        value={decision}
                        onChange={(e) => updateDecision(index, e.target.value)}
                        rows={2}
                        placeholder="Descrição da decisão..."
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeDecision(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <ul className="list-disc list-inside space-y-2">
                    {(ata.decisions as string[] || []).map((decision, index) => (
                      <li key={index} className="text-sm">
                        {decision}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Action Items Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Itens de Ação</CardTitle>
              {editing && (
                <Button size="sm" variant="outline" onClick={addActionItem}>
                  Adicionar
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {editing ? (
                  editedData.action_items.map((item, index) => (
                    <Card key={index} className="p-4">
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-xs font-medium mb-1 block">Tarefa</label>
                            <Textarea
                              value={item.task}
                              onChange={(e) =>
                                updateActionItem(index, "task", e.target.value)
                              }
                              rows={2}
                              placeholder="Descrição da tarefa..."
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeActionItem(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium mb-1 block">Responsável</label>
                            <Textarea
                              value={item.responsible}
                              onChange={(e) =>
                                updateActionItem(index, "responsible", e.target.value)
                              }
                              rows={1}
                              placeholder="Nome do responsável..."
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block">Prazo</label>
                            <Textarea
                              value={item.deadline}
                              onChange={(e) =>
                                updateActionItem(index, "deadline", e.target.value)
                              }
                              rows={1}
                              placeholder="Prazo da tarefa..."
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <div className="space-y-3">
                    {((ata.action_items as { task: string; responsible: string; deadline: string }[]) || []).map((item, index) => (
                      <Card key={index} className="p-4">
                        <p className="font-medium text-sm mb-2">{item.task}</p>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>👤 {item.responsible}</span>
                          <span>📅 {item.deadline}</span>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Full Content Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">ATA Completa</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <Textarea
                  value={editedData.content}
                  onChange={(e) =>
                    setEditedData({ ...editedData, content: e.target.value })
                  }
                  rows={12}
                  placeholder="Conteúdo completo da ATA em markdown..."
                  className="font-mono text-sm"
                />
              ) : (
                <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                  {ata.content}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-between gap-3 pt-4 border-t">
            <div>
              {ata.status === "approved" && (
                <Button variant="outline" onClick={handleGeneratePDF}>
                  <Download className="mr-2 h-4 w-4" />
                  Baixar PDF
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              {editing ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditing(false);
                      setEditedData({
                        summary: ata.summary || "",
                        decisions: (ata.decisions as string[]) || [],
                        action_items: (ata.action_items as { task: string; responsible: string; deadline: string }[]) || [],
                        content: ata.content || "",
                      });
                    }}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </>
              ) : ata.status === "draft" ? (
                <>
                  <Button variant="outline" onClick={handleReject}>
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <Button onClick={handleApprove}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Aprovar ATA
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
