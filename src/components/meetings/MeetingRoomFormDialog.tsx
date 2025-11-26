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
  area_id?: string | null;
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

interface Company {
  id: string;
  name: string;
}

interface Area {
  id: string;
  name: string;
  company_id: string | null;
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
  const [companies, setCompanies] = useState<Company[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [filteredAreas, setFilteredAreas] = useState<Area[]>([]);
  const [formData, setFormData] = useState<MeetingRoom>(
    room || {
      name: "",
      company_id: "",
      area_id: null,
      teams_link: "",
      is_active: true,
      description: "",
    }
  );

  useEffect(() => {
    const fetchData = async () => {
      const [companiesResult, areasResult] = await Promise.all([
        supabase
          .from("companies")
          .select("id, name")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("areas")
          .select("id, name, company_id")
          .order("name"),
      ]);
      
      if (companiesResult.data) {
        setCompanies(companiesResult.data);
      }
      
      if (areasResult.data) {
        setAreas(areasResult.data);
      }
    };
    
    fetchData();
  }, []);

  useEffect(() => {
    if (formData.company_id) {
      const filtered = areas.filter(area => area.company_id === formData.company_id);
      setFilteredAreas(filtered);
    } else {
      setFilteredAreas([]);
    }
  }, [formData.company_id, areas]);

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
        area_id: null,
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
      const roomData = {
        name: formData.name,
        company: "", // Manter temporariamente para retrocompatibilidade
        company_id: formData.company_id,
        area_id: formData.area_id || null,
        team: "", // Manter vazio para retrocompatibilidade
        teams_link: formData.teams_link,
        is_active: formData.is_active,
        description: formData.description || null,
      };

      if (room?.id) {
        // Update existing room
        const { error } = await supabase
          .from("meeting_rooms")
          .update(roomData)
          .eq("id", room.id);

        if (error) throw error;

        toast({
          title: "Sala atualizada",
          description: "Sala de reunião atualizada com sucesso.",
        });
      } else {
        // Create new room
        const { error } = await supabase.from("meeting_rooms").insert(roomData);

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
            <Label htmlFor="name">Nome da Sala *</Label>
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
            <Label htmlFor="company">Empresa *</Label>
            <Select
              value={formData.company_id}
              onValueChange={(value) => {
                setFormData({ ...formData, company_id: value, area_id: null });
              }}
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
            <Label htmlFor="area">Área/Setor (opcional)</Label>
            <Select
              value={formData.area_id || "none"}
              onValueChange={(value) =>
                setFormData({ ...formData, area_id: value === "none" ? null : value })
              }
              disabled={!formData.company_id}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  formData.company_id 
                    ? "Selecione uma área" 
                    : "Selecione uma empresa primeiro"
                } />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma área específica</SelectItem>
                {filteredAreas.map((area) => (
                  <SelectItem key={area.id} value={area.id}>
                    {area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!formData.company_id && (
              <p className="text-xs text-muted-foreground mt-1">
                Selecione uma empresa para ver as áreas disponíveis
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="teams_link">Link do Microsoft Teams *</Label>
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
              className={linkError ? "border-destructive" : ""}
            />
            {linkError && (
              <p className="text-sm text-destructive mt-1">{linkError}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Descrição (opcional)</Label>
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
