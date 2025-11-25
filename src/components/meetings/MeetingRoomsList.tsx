import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, ExternalLink } from "lucide-react";
import { MeetingRoomFormDialog } from "./MeetingRoomFormDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MeetingRoom {
  id: string;
  name: string;
  company: string;
  team: string;
  teams_link: string;
  is_active: boolean;
}

export function MeetingRoomsList() {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<MeetingRoom | null>(null);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from("meeting_rooms")
        .select("*")
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => (
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
              <div>
                <p className="text-sm text-muted-foreground">Empresa</p>
                <p className="font-medium">{room.company}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Equipe</p>
                <p className="font-medium">{room.team}</p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(room)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
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
