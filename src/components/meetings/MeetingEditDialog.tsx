import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/external-client";
import { format } from "date-fns";

interface MeetingEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  meetingId: string;
  editScope: "single" | "future";
}

export function MeetingEditDialog({
  open,
  onOpenChange,
  onSuccess,
  meetingId,
  editScope,
}: MeetingEditDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [areas, setAreas] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    type: "Tática" as const,
    area_id: "",
    meeting_room_id: "",
    scheduled_at: "",
    duration_minutes: 60,
    ai_mode: "Obrigatória" as const,
  });

  useEffect(() => {
    if (open) {
      fetchMeetingData();
      fetchAreas();
      fetchRooms();
    }
  }, [open, meetingId]);

  const fetchMeetingData = async () => {
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", meetingId)
      .single();

    if (error) {
      toast({
        title: "Erro ao carregar reunião",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    if (data) {
      // Format the datetime for the input
      const scheduledDate = new Date(data.scheduled_at);
      const formattedDate = format(scheduledDate, "yyyy-MM-dd'T'HH:mm");

      setFormData({
        title: data.title,
        type: data.type as any,
        area_id: data.area_id || "",
        meeting_room_id: data.meeting_room_id,
        scheduled_at: formattedDate,
        duration_minutes: data.duration_minutes,
        ai_mode: data.ai_mode as any,
      });
    }
  };

  const fetchAreas = async () => {
    const { data } = await supabase.from("areas").select("*").order("name");
    setAreas(data || []);
  };

  const fetchRooms = async () => {
    const { data } = await supabase
      .from("meeting_rooms")
      .select("*")
      .eq("is_active", true)
      .order("name");
    setRooms(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editScope === "single") {
        // Update only this meeting
        const { error } = await supabase
          .from("meetings")
          .update({
            title: formData.title,
            type: formData.type,
            area_id: formData.area_id || null,
            meeting_room_id: formData.meeting_room_id,
            scheduled_at: formData.scheduled_at,
            duration_minutes: formData.duration_minutes,
            ai_mode: formData.ai_mode,
          })
          .eq("id", meetingId);

        if (error) throw error;

        toast({
          title: "Reunião atualizada",
          description: "Reunião atualizada com sucesso.",
        });
      } else {
        // Update this and all future meetings in the series
        // First, get the current meeting to find parent and scheduled date
        const { data: currentMeeting, error: fetchError } = await supabase
          .from("meetings")
          .select("parent_meeting_id, scheduled_at, recurrence_index")
          .eq("id", meetingId)
          .single();

        if (fetchError) throw fetchError;

        // Determine which meetings to update
        const parentId = currentMeeting.parent_meeting_id || meetingId;
        const currentScheduledAt = new Date(currentMeeting.scheduled_at);

        const { error: updateError } = await supabase
          .from("meetings")
          .update({
            title: formData.title,
            type: formData.type,
            area_id: formData.area_id || null,
            meeting_room_id: formData.meeting_room_id,
            duration_minutes: formData.duration_minutes,
            ai_mode: formData.ai_mode,
          })
          .or(`id.eq.${meetingId},and(parent_meeting_id.eq.${parentId},scheduled_at.gte.${currentScheduledAt.toISOString()})`)
          .gte("scheduled_at", currentScheduledAt.toISOString());

        if (updateError) throw updateError;

        toast({
          title: "Reuniões atualizadas",
          description: "Esta reunião e todas as futuras foram atualizadas.",
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
          <DialogTitle>
            Editar Reunião {editScope === "future" && "- Série Completa"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Título da Reunião</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {editScope === "single" && (
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
          )}

          {editScope === "future" && (
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
              <p className="text-sm text-muted-foreground mt-2">
                As datas das reuniões futuras não serão alteradas.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
