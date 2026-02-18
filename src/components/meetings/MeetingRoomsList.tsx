import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Edit, Search, Video, Trash2 } from "lucide-react";
import { MeetingRoomFormDialog } from "./MeetingRoomFormDialog";
import { MeetingPlatformButton } from "./MeetingPlatformButton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/external-client";
import { platformConfig, MeetingPlatform } from "@/lib/platformConfig";

interface MeetingRoom {
  id: string;
  name: string;
  company_id: string;
  area_id?: string | null;
  teams_link: string;
  platform?: string;
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
  const { role, checkPermission } = useAuth();
  // ...

  // Verificar se pode deletar
  const canDelete = checkPermission('meetings', 'delete');

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [filterArea, setFilterArea] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPlatform, setFilterPlatform] = useState<string>("all");

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

  const handleDeleteRoom = async () => {
    if (!roomToDelete) return;

    try {
      // 1. Buscar reuniões desta sala
      const { data: roomMeetings } = await supabase
        .from("meetings")
        .select("id")
        .eq("meeting_room_id", roomToDelete.id);

      let deletedCount = 0;
      let preservedCount = 0;

      if (roomMeetings && roomMeetings.length > 0) {
        const meetingIds = roomMeetings.map(m => m.id);

        // 2. Identificar reuniões COM ATAs ou transcrições (preservar)
        const { data: meetingsWithAtas } = await supabase
          .from("meeting_atas")
          .select("meeting_id")
          .in("meeting_id", meetingIds);

        const { data: meetingsWithTranscriptions } = await supabase
          .from("meeting_transcriptions")
          .select("meeting_id")
          .in("meeting_id", meetingIds);

        const meetingsToPreserve = new Set([
          ...(meetingsWithAtas || []).map(a => a.meeting_id),
          ...(meetingsWithTranscriptions || []).map(t => t.meeting_id)
        ]);

        preservedCount = meetingsToPreserve.size;

        // 3. Desvincular reuniões com histórico da sala
        if (meetingsToPreserve.size > 0) {
          await supabase
            .from("meetings")
            .update({ meeting_room_id: null })
            .in("id", Array.from(meetingsToPreserve));
        }

        // 4. Identificar reuniões SEM histórico (excluir)
        const meetingsToDelete = meetingIds.filter(id => !meetingsToPreserve.has(id));
        deletedCount = meetingsToDelete.length;

        if (meetingsToDelete.length > 0) {
          // Excluir dados relacionados na ordem correta
          await supabase.from("meeting_reminders").delete().in("meeting_id", meetingsToDelete);
          await supabase.from("meeting_tasks").delete().in("meeting_id", meetingsToDelete);
          await supabase.from("meeting_agendas").delete().in("meeting_id", meetingsToDelete);
          await supabase.from("meeting_participants").delete().in("meeting_id", meetingsToDelete);

          // Excluir reuniões
          await supabase.from("meetings").delete().in("id", meetingsToDelete);
        }
      }

      // 5. Excluir a sala
      const { error } = await supabase
        .from("meeting_rooms")
        .delete()
        .eq("id", roomToDelete.id);

      if (error) throw error;

      const messages = [];
      if (deletedCount > 0) messages.push(`${deletedCount} reunião(ões) excluída(s)`);
      if (preservedCount > 0) messages.push(`${preservedCount} reunião(ões) com histórico preservada(s)`);

      toast({
        title: "Sala excluída",
        description: messages.length > 0
          ? `Sala excluída. ${messages.join(", ")}.`
          : "Sala de reunião excluída com sucesso.",
      });

      fetchRooms();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir sala",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setRoomToDelete(null);
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
      const matchesPlatform = filterPlatform === "all" ||
        (room.platform || "teams") === filterPlatform;

      return matchesSearch && matchesCompany && matchesArea && matchesStatus && matchesPlatform;
    });
  }, [rooms, searchTerm, filterCompany, filterArea, filterStatus, filterPlatform]);

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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
              <Label htmlFor="platform">Plataforma</Label>
              <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                <SelectTrigger id="platform">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="teams">Microsoft Teams</SelectItem>
                  <SelectItem value="zoom">Zoom</SelectItem>
                  <SelectItem value="google_meet">Google Meet</SelectItem>
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
        {filteredRooms.map((room) => {
          const platform = (room.platform || "teams") as MeetingPlatform;
          const platformInfo = platformConfig[platform];

          return (
            <Card key={room.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{room.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          setRoomToDelete(room);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Badge
                      variant="outline"
                      style={{
                        borderColor: platformInfo.color,
                        color: platformInfo.color,
                      }}
                    >
                      <Video className="h-3 w-3 mr-1" />
                      {platformInfo.shortName}
                    </Badge>
                    <Badge variant={room.is_active ? "default" : "secondary"}>
                      {room.is_active ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
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
                  <MeetingPlatformButton
                    platform={platform}
                    link={room.teams_link}
                    size="sm"
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Sala de Reunião</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Tem certeza que deseja excluir a sala "{roomToDelete?.name}"?
              </span>
              <span className="block text-sm">
                • Reuniões sem histórico serão excluídas do calendário
              </span>
              <span className="block text-sm">
                • Reuniões com ATAs ou transcrições serão mantidas (desvinculadas da sala)
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRoomToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRoom}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
