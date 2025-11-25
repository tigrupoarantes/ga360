import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Users, UserPlus, Check, X, Mail, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MeetingParticipantsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  meetingTitle: string;
  meetingDate: string;
}

interface Participant {
  id: string;
  user_id: string;
  attended: boolean;
  profiles: {
    first_name: string;
    last_name: string;
  };
}

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
}

export function MeetingParticipants({ 
  open, 
  onOpenChange, 
  meetingId,
  meetingTitle,
  meetingDate 
}: MeetingParticipantsProps) {
  const { toast } = useToast();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [notifying, setNotifying] = useState(false);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, meetingId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Buscar participantes da reunião
      const { data: participantsData, error: participantsError } = await supabase
        .from('meeting_participants')
        .select(`
          id,
          user_id,
          attended,
          profiles:user_id (
            first_name,
            last_name
          )
        `)
        .eq('meeting_id', meetingId);

      if (participantsError) throw participantsError;

      setParticipants(participantsData as any || []);

      // Buscar todos os usuários disponíveis
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('is_active', true)
        .order('first_name');

      if (usersError) throw usersError;

      // Filtrar usuários que já não são participantes
      const participantIds = participantsData?.map(p => p.user_id) || [];
      const filtered = (usersData || []).filter(
        user => !participantIds.includes(user.id)
      );

      setAvailableUsers(filtered);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddParticipant = async () => {
    if (!selectedUserId) {
      toast({
        title: "Selecione um participante",
        description: "Por favor, selecione um usuário para adicionar.",
        variant: "destructive",
      });
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase
        .from('meeting_participants')
        .insert({
          meeting_id: meetingId,
          user_id: selectedUserId,
          attended: false,
        });

      if (error) throw error;

      toast({
        title: "Participante adicionado",
        description: "O participante foi adicionado com sucesso.",
      });

      setSelectedUserId('');
      fetchData();
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar participante",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleToggleAttendance = async (participantId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('meeting_participants')
        .update({ attended: !currentStatus })
        .eq('id', participantId);

      if (error) throw error;

      toast({
        title: "Presença atualizada",
        description: "O status de presença foi atualizado.",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar presença",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    try {
      const { error } = await supabase
        .from('meeting_participants')
        .delete()
        .eq('id', participantId);

      if (error) throw error;

      toast({
        title: "Participante removido",
        description: "O participante foi removido da reunião.",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Erro ao remover participante",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleNotifyParticipants = async () => {
    setNotifying(true);
    try {
      const { error } = await supabase.functions.invoke('send-meeting-notification', {
        body: {
          meetingId,
          meetingTitle,
          meetingDate,
          participantIds: participants.map(p => p.user_id),
        }
      });

      if (error) throw error;

      toast({
        title: "Notificações enviadas",
        description: "Todos os participantes foram notificados por email.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar notificações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setNotifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Participantes da Reunião
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Adicionar Participante */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-2">
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione um participante" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.first_name} {user.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleAddParticipant} 
                    disabled={adding || !selectedUserId}
                  >
                    {adding ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Participantes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">
                  Participantes ({participants.length})
                </h3>
                {participants.length > 0 && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleNotifyParticipants}
                    disabled={notifying}
                  >
                    {notifying ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Notificar Todos
                      </>
                    )}
                  </Button>
                )}
              </div>

              {participants.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Nenhum participante adicionado ainda.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {participants.map(participant => (
                    <Card key={participant.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <p className="font-medium">
                                {participant.profiles.first_name} {participant.profiles.last_name}
                              </p>
                            </div>
                            <Badge 
                              variant={participant.attended ? "default" : "secondary"}
                            >
                              {participant.attended ? "Presente" : "Ausente"}
                            </Badge>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleAttendance(
                                participant.id, 
                                participant.attended
                              )}
                            >
                              {participant.attended ? (
                                <X className="h-4 w-4" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveParticipant(participant.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
