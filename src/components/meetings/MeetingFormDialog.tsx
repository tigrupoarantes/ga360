import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
      fetchAreas();
      fetchRooms();
    }
  }, [open]);

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
      const { error: meetingError } = await supabase.from("meetings").insert({
        title: formData.title,
        type: formData.type,
        area_id: formData.area_id || null,
        meeting_room_id: formData.meeting_room_id,
        scheduled_at: formData.scheduled_at,
        duration_minutes: formData.duration_minutes,
        ai_mode: formData.ai_mode,
        status: "Agendada",
      });

      if (meetingError) throw meetingError;

      toast({
        title: "Reunião criada",
        description: "Reunião agendada com sucesso.",
      });

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
                    {room.name} - {room.team}
                  </SelectItem>
                ))}
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
