import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MeetingRoom {
  id?: string;
  name: string;
  company_id: string;
  team: string;
  teams_link: string;
  is_active?: boolean;
  description?: string | null;
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
  const [linkError, setLinkError] = useState<string>("");
  const [companies, setCompanies] = useState<any[]>([]);
  const [formData, setFormData] = useState<MeetingRoom>(
    room || {
      name: "",
      company_id: "",
      team: "",
      teams_link: "",
      is_active: true,
      description: "",
    }
  );

  useEffect(() => {
    const fetchCompanies = async () => {
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("is_active", true)
        .order("name");
      
      if (data) {
        setCompanies(data);
      }
    };
    
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (room) {
      setFormData({
        ...room,
        description: room.description || "",
      });
    } else {
      setFormData({
        name: "",
        company_id: "",
        team: "",
        teams_link: "",
        is_active: true,
        description: "",
      });
    }
    setLinkError("");
  }, [room, open]);

  const validateTeamsLink = (link: string): boolean => {
    const teamsPatterns = [
      /^https:\/\/teams\.microsoft\.com\/l\/meetup-join\/.+/,
      /^https:\/\/teams\.live\.com\/meet\/.+/,
      /^https:\/\/[a-z0-9-]+\.teams\.microsoft\.com\/.+/,
    ];
    
    return teamsPatterns.some(pattern => pattern.test(link));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar link do Teams
    if (!validateTeamsLink(formData.teams_link)) {
      setLinkError("Link inválido. Use um link do Microsoft Teams válido.");
      return;
    }
    
    setLoading(true);
    setLinkError("");

    try {
      if (room?.id) {
        // Update existing room
        const { error } = await supabase
          .from("meeting_rooms")
          .update({
            name: formData.name,
            company: "", // Manter temporariamente para retrocompatibilidade
            company_id: formData.company_id,
            team: formData.team,
            teams_link: formData.teams_link,
            is_active: formData.is_active,
            description: formData.description || null,
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
          company: "", // Manter temporariamente para retrocompatibilidade
          company_id: formData.company_id,
          team: formData.team,
          teams_link: formData.teams_link,
          is_active: formData.is_active ?? true,
          description: formData.description || null,
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
            <Select
              value={formData.company_id}
              onValueChange={(value) =>
                setFormData({ ...formData, company_id: value })
              }
              required
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
              onChange={(e) => {
                setFormData({ ...formData, teams_link: e.target.value });
                setLinkError("");
              }}
              placeholder="https://teams.microsoft.com/l/meetup-join/..."
              required
              className={linkError ? "border-red-500" : ""}
            />
            {linkError && (
              <p className="text-sm text-red-500 mt-1">{linkError}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Descrição (Opcional)</Label>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Sala utilizada para reuniões semanais de diretoria..."
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="is_active"
              checked={formData.is_active ?? true}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_active: checked })
              }
            />
            <Label htmlFor="is_active">
              {formData.is_active ? "Sala Ativa" : "Sala Inativa"}
            </Label>
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
