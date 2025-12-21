import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

interface MeetingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function MeetingFormDialog({
  open,
  onOpenChange,
  onSuccess,
}: MeetingFormDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [areas, setAreas] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [allRooms, setAllRooms] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const { selectedCompanyId } = useCompany();
  const [formData, setFormData] = useState({
    title: "",
    type: "Tática" as const,
    area_id: "",
    meeting_room_id: "",
    scheduled_at: "",
    duration_minutes: 60,
    ai_mode: "Obrigatória" as const,
    company_id: selectedCompanyId || "",
    recurrence_type: "none" as const,
    recurrence_end_date: "",
  });

  useEffect(() => {
    if (open) {
      fetchAreas();
      fetchRooms();
      fetchCompanies();
      setFormData(prev => ({ ...prev, company_id: selectedCompanyId || "" }));
    }
  }, [open, selectedCompanyId]);

  // Filtrar salas pela empresa selecionada
  useEffect(() => {
    if (formData.company_id) {
      const filtered = allRooms.filter(r => r.company_id === formData.company_id);
      setRooms(filtered);
    } else {
      setRooms(allRooms);
    }
  }, [formData.company_id, allRooms]);

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from("companies")
      .select("*")
      .eq("is_active", true)
      .order("name");
    setCompanies(data || []);
  };

  const fetchAreas = async () => {
    const { data } = await supabase.from("areas").select("*").order("name");
    setAreas(data || []);
  };

  const fetchRooms = async () => {
    const { data } = await supabase
      .from("meeting_rooms")
      .select("*, companies(name)")
      .eq("is_active", true)
      .order("name");
    setAllRooms(data || []);
    setRooms(data || []);
  };

  const generateRecurringMeetings = (startDate: Date, endDate: Date, type: string) => {
    const meetings = [];
    const current = new Date(startDate);
    let index = 0;
    const MAX_OCCURRENCES = 52; // Safety limit

    while (current <= endDate && index < MAX_OCCURRENCES) {
      meetings.push({
        scheduled_at: current.toISOString(),
        recurrence_index: index,
      });

      index++;

      // Calculate next occurrence
      if (type === "daily") {
        current.setDate(current.getDate() + 1);
      } else if (type === "weekly") {
        current.setDate(current.getDate() + 7);
      } else if (type === "monthly") {
        current.setMonth(current.getMonth() + 1);
      }
    }

    return meetings;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const baseScheduledAt = new Date(formData.scheduled_at);

      // If no recurrence, create single meeting
      if (formData.recurrence_type === "none") {
        const { error: meetingError } = await supabase.from("meetings").insert({
          title: formData.title,
          type: formData.type,
          area_id: formData.area_id || null,
          meeting_room_id: formData.meeting_room_id,
          scheduled_at: formData.scheduled_at,
          duration_minutes: formData.duration_minutes,
          ai_mode: formData.ai_mode,
          status: "Agendada",
          recurrence_type: "none",
        });

        if (meetingError) throw meetingError;

        toast({
          title: "Reunião criada",
          description: "Reunião agendada com sucesso.",
        });
      } else {
        // Generate recurring meetings
        if (!formData.recurrence_end_date) {
          throw new Error("Data final da recorrência é obrigatória");
        }

        const endDate = new Date(formData.recurrence_end_date);
        const occurrences = generateRecurringMeetings(
          baseScheduledAt,
          endDate,
          formData.recurrence_type
        );

        // Insert parent meeting first
        const { data: parentMeeting, error: parentError } = await supabase
          .from("meetings")
          .insert({
            title: formData.title,
            type: formData.type,
            area_id: formData.area_id || null,
            meeting_room_id: formData.meeting_room_id,
            scheduled_at: formData.scheduled_at,
            duration_minutes: formData.duration_minutes,
            ai_mode: formData.ai_mode,
            status: "Agendada",
            recurrence_type: formData.recurrence_type,
            recurrence_end_date: formData.recurrence_end_date,
            parent_meeting_id: null,
            recurrence_index: 0,
          })
          .select()
          .single();

        if (parentError) throw parentError;

        // Insert child meetings (skip first as it's the parent)
        if (occurrences.length > 1) {
          const childMeetings = occurrences.slice(1).map((occ) => ({
            title: formData.title,
            type: formData.type,
            area_id: formData.area_id || null,
            meeting_room_id: formData.meeting_room_id,
            scheduled_at: occ.scheduled_at,
            duration_minutes: formData.duration_minutes,
            ai_mode: formData.ai_mode,
            status: "Agendada",
            recurrence_type: formData.recurrence_type,
            recurrence_end_date: formData.recurrence_end_date,
            parent_meeting_id: parentMeeting.id,
            recurrence_index: occ.recurrence_index,
          }));

          const { error: childError } = await supabase
            .from("meetings")
            .insert(childMeetings);

          if (childError) throw childError;
        }

        toast({
          title: "Reuniões criadas",
          description: `${occurrences.length} reunião(ões) agendada(s) com sucesso.`,
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Nova Reunião</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Título da Reunião</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Reunião Estratégica Q1"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Tipo</Label>
              <Select
                value={formData.type}
                onValueChange={(value: any) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Estratégica">Estratégica</SelectItem>
                  <SelectItem value="Tática">Tática</SelectItem>
                  <SelectItem value="Operacional">Operacional</SelectItem>
                  <SelectItem value="Trade">Trade</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="ai_mode">Modo IA</Label>
              <Select
                value={formData.ai_mode}
                onValueChange={(value: any) => setFormData({ ...formData, ai_mode: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Obrigatória">Obrigatória</SelectItem>
                  <SelectItem value="Opcional">Opcional</SelectItem>
                  <SelectItem value="Desativada">Desativada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="company">Empresa</Label>
              <Select
                value={formData.company_id}
                onValueChange={(value) => setFormData({ 
                  ...formData, 
                  company_id: value,
                  meeting_room_id: "" // Reset sala ao mudar empresa
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="area">Área</Label>
              <Select
                value={formData.area_id}
                onValueChange={(value) => setFormData({ ...formData, area_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma área" />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="room">Sala de Reunião</Label>
            <Select
              value={formData.meeting_room_id}
              onValueChange={(value) => setFormData({ ...formData, meeting_room_id: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma sala" />
              </SelectTrigger>
              <SelectContent>
                {rooms.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    {formData.company_id 
                      ? "Nenhuma sala encontrada para esta empresa" 
                      : "Selecione uma empresa primeiro"}
                  </div>
                ) : (
                  rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name} - {room.team}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="scheduled_at">Data e Hora</Label>
              <Input
                id="scheduled_at"
                type="datetime-local"
                value={formData.scheduled_at}
                onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="duration">Duração (minutos)</Label>
              <Input
                id="duration"
                type="number"
                min="15"
                step="15"
                value={formData.duration_minutes}
                onChange={(e) =>
                  setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })
                }
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="recurrence">Recorrência</Label>
              <Select
                value={formData.recurrence_type}
                onValueChange={(value: any) => setFormData({ ...formData, recurrence_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não repetir</SelectItem>
                  <SelectItem value="daily">Diária</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.recurrence_type !== "none" && (
              <div>
                <Label htmlFor="recurrence_end">Repetir até</Label>
                <Input
                  id="recurrence_end"
                  type="date"
                  value={formData.recurrence_end_date}
                  onChange={(e) => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                  required
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar Reunião"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
