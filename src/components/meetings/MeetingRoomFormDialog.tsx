import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MeetingRoom {
  id?: string;
  name: string;
  company: string;
  team: string;
  teams_link: string;
  is_active?: boolean;
}

interface MeetingRoomFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room?: MeetingRoom | null;
  onSuccess: () => void;
}

export function MeetingRoomFormDialog({
  open,
  onOpenChange,
  room,
  onSuccess,
}: MeetingRoomFormDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<MeetingRoom>(
    room || {
      name: "",
      company: "",
      team: "",
      teams_link: "",
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (room?.id) {
        // Update existing room
        const { error } = await supabase
          .from("meeting_rooms")
          .update({
            name: formData.name,
            company: formData.company,
            team: formData.team,
            teams_link: formData.teams_link,
          })
          .eq("id", room.id);

        if (error) throw error;

        toast({
          title: "Sala atualizada",
          description: "Sala de reunião atualizada com sucesso.",
        });
      } else {
        // Create new room
        const { error } = await supabase.from("meeting_rooms").insert({
          name: formData.name,
          company: formData.company,
          team: formData.team,
          teams_link: formData.teams_link,
        });

        if (error) throw error;

        toast({
          title: "Sala criada",
          description: "Sala de reunião criada com sucesso.",
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {room ? "Editar Sala de Reunião" : "Nova Sala de Reunião"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome da Sala</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Ex: Sala Diretoria"
              required
            />
          </div>

          <div>
            <Label htmlFor="company">Empresa</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) =>
                setFormData({ ...formData, company: e.target.value })
              }
              placeholder="Ex: Grupo Arantes"
              required
            />
          </div>

          <div>
            <Label htmlFor="team">Equipe</Label>
            <Input
              id="team"
              value={formData.team}
              onChange={(e) =>
                setFormData({ ...formData, team: e.target.value })
              }
              placeholder="Ex: Comercial"
              required
            />
          </div>

          <div>
            <Label htmlFor="teams_link">Link do Microsoft Teams</Label>
            <Input
              id="teams_link"
              type="url"
              value={formData.teams_link}
              onChange={(e) =>
                setFormData({ ...formData, teams_link: e.target.value })
              }
              placeholder="https://teams.microsoft.com/..."
              required
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : room ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
