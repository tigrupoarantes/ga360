import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, ExternalLink, Search } from "lucide-react";
import { MeetingRoomFormDialog } from "./MeetingRoomFormDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MeetingRoom {
  id: string;
  name: string;
  company_id: string;
  area_id?: string | null;
  teams_link: string;
  is_active: boolean;
  description?: string | null;
  companies?: {
    name: string;
    color?: string;
  };
  areas?: {
    name: string;
  };
}

export function MeetingRoomsList() {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<MeetingRoom | null>(null);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [filterArea, setFilterArea] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from("meeting_rooms")
        .select("*, companies(name, color), areas(name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRooms(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar salas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleEdit = (room: MeetingRoom) => {
    setSelectedRoom(room);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setSelectedRoom(null);
    setDialogOpen(true);
  };

  const handleSuccess = () => {
    fetchRooms();
  };

  const handleToggleActive = async (roomId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("meeting_rooms")
        .update({ is_active: !currentStatus })
        .eq("id", roomId);

      if (error) throw error;

      toast({
        title: !currentStatus ? "Sala ativada" : "Sala desativada",
        description: "Status da sala atualizado com sucesso.",
      });

      fetchRooms();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Extrair opções únicas para filtros
  const companies = useMemo(() => {
    const unique = Array.from(new Set(rooms.map(r => r.companies?.name).filter(Boolean)));
    return unique.sort();
  }, [rooms]);

  const areaNames = useMemo(() => {
    const unique = Array.from(new Set(rooms.map(r => r.areas?.name).filter(Boolean)));
    return unique.sort();
  }, [rooms]);

  // Aplicar filtros
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCompany = filterCompany === "all" || room.companies?.name === filterCompany;
      const matchesArea = filterArea === "all" || room.areas?.name === filterArea;
      const matchesStatus = filterStatus === "all" || 
        (filterStatus === "active" && room.is_active) ||
        (filterStatus === "inactive" && !room.is_active);
      
      return matchesSearch && matchesCompany && matchesArea && matchesStatus;
    });
  }, [rooms, searchTerm, filterCompany, filterArea, filterStatus]);

  if (loading) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Salas de Reunião</h2>
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Sala
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar por nome</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Digite o nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Empresa</Label>
              <Select value={filterCompany} onValueChange={setFilterCompany}>
                <SelectTrigger id="company">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company} value={company}>
                      {company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="area">Área</Label>
              <Select value={filterArea} onValueChange={setFilterArea}>
                <SelectTrigger id="area">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {areaNames.map((area) => (
                    <SelectItem key={area} value={area}>
                      {area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativas</SelectItem>
                  <SelectItem value="inactive">Inativas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredRooms.map((room) => (
          <Card key={room.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{room.name}</CardTitle>
                <Badge variant={room.is_active ? "default" : "secondary"}>
                  {room.is_active ? "Ativa" : "Inativa"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {room.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Descrição</p>
                  <p className="text-sm line-clamp-2">{room.description}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Empresa</p>
                <p className="font-medium">{room.companies?.name || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Área/Setor</p>
                <p className="font-medium">{room.areas?.name || "Sem área definida"}</p>
              </div>
              <div className="flex items-center gap-2 pt-2 pb-2">
                <Label htmlFor={`active-${room.id}`} className="text-sm">
                  {room.is_active ? "Ativa" : "Inativa"}
                </Label>
                <Switch
                  id={`active-${room.id}`}
                  checked={room.is_active}
                  onCheckedChange={() => handleToggleActive(room.id, room.is_active)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(room)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  className="bg-[#0078D4] hover:bg-[#106EBE] text-white"
                  onClick={() => window.open(room.teams_link, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Teams
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredRooms.length === 0 && rooms.length > 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              Nenhuma sala encontrada com os filtros aplicados
            </p>
          </CardContent>
        </Card>
      )}

      {rooms.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">
              Nenhuma sala de reunião cadastrada
            </p>
            <Button onClick={handleNew}>
              <Plus className="mr-2 h-4 w-4" />
              Criar primeira sala
            </Button>
          </CardContent>
        </Card>
      )}

      <MeetingRoomFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        room={selectedRoom}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
