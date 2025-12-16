import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { RealtimeTranscription } from '@/components/meetings/RealtimeTranscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, 
  Clock, 
  MapPin, 
  Users, 
  CheckCircle2,
  Video,
  FileText,
  Loader2,
  ExternalLink
} from 'lucide-react';

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  ai_mode: string;
  meeting_rooms?: {
    name: string;
    teams_link: string | null;
  };
  areas?: {
    name: string;
  };
}

interface AgendaItem {
  id: string;
  content: string;
  is_completed: boolean;
  order_index: number;
}

interface Participant {
  id: string;
  user_id: string;
  confirmation_status: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
}

export default function MeetingExecution() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [transcription, setTranscription] = useState('');
  const [finalizingMeeting, setFinalizingMeeting] = useState(false);

  const fetchMeetingData = useCallback(async () => {
    if (!id) return;

    try {
      // Fetch meeting details
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select(`
          *,
          meeting_rooms (name, teams_link),
          areas (name)
        `)
        .eq('id', id)
        .single();

      if (meetingError) throw meetingError;
      setMeeting(meetingData);

      // Fetch agenda items
      const { data: agendaData, error: agendaError } = await supabase
        .from('meeting_agendas')
        .select('*')
        .eq('meeting_id', id)
        .order('order_index');

      if (agendaError) throw agendaError;
      setAgendaItems(agendaData || []);

      // Fetch participants
      const { data: participantsData, error: participantsError } = await supabase
        .from('meeting_participants')
        .select('*')
        .eq('meeting_id', id);

      if (participantsError) throw participantsError;
      
      // Fetch profiles for participants
      if (participantsData && participantsData.length > 0) {
        const userIds = participantsData.map(p => p.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url')
          .in('id', userIds);
        
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        
        const enrichedParticipants = participantsData.map(p => ({
          id: p.id,
          user_id: p.user_id,
          confirmation_status: p.confirmation_status,
          first_name: profilesMap.get(p.user_id)?.first_name,
          last_name: profilesMap.get(p.user_id)?.last_name,
          avatar_url: profilesMap.get(p.user_id)?.avatar_url,
        }));
        
        setParticipants(enrichedParticipants);
      } else {
        setParticipants([]);
      }

      // Update meeting status to "Em Andamento" if not already
      if (meetingData.status !== 'Em Andamento' && meetingData.status !== 'Concluída') {
        await supabase
          .from('meetings')
          .update({ status: 'Em Andamento' })
          .eq('id', id);
      }

    } catch (error: unknown) {
      console.error('Error fetching meeting data:', error);
      toast({
        title: 'Erro ao carregar reunião',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchMeetingData();
  }, [fetchMeetingData]);

  const toggleAgendaItem = async (itemId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('meeting_agendas')
        .update({ is_completed: !currentStatus })
        .eq('id', itemId);

      if (error) throw error;

      setAgendaItems(prev => 
        prev.map(item => 
          item.id === itemId 
            ? { ...item, is_completed: !currentStatus }
            : item
        )
      );
    } catch (error: unknown) {
      console.error('Error updating agenda item:', error);
      toast({
        title: 'Erro ao atualizar pauta',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const handleFinalizeMeeting = async () => {
    if (!meeting) return;

    // Check if transcription is required and completed
    if (meeting.ai_mode === 'Obrigatório' && !transcription) {
      toast({
        title: 'Transcrição obrigatória',
        description: 'Esta reunião requer transcrição completa antes de ser finalizada.',
        variant: 'destructive',
      });
      return;
    }

    setFinalizingMeeting(true);

    try {
      // Update meeting status
      const { error: updateError } = await supabase
        .from('meetings')
        .update({ status: 'Concluída' })
        .eq('id', meeting.id);

      if (updateError) throw updateError;

      toast({
        title: 'Reunião finalizada',
        description: 'A reunião foi concluída com sucesso.',
      });

      navigate('/meetings');
    } catch (error: unknown) {
      console.error('Error finalizing meeting:', error);
      toast({
        title: 'Erro ao finalizar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setFinalizingMeeting(false);
    }
  };

  const openTeamsLink = () => {
    if (meeting?.meeting_rooms?.teams_link) {
      window.open(meeting.meeting_rooms.teams_link, '_blank');
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!meeting) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Reunião não encontrada</h2>
          <Button className="mt-4" onClick={() => navigate('/meetings')}>
            Voltar para Reuniões
          </Button>
        </div>
      </MainLayout>
    );
  }

  const completedItems = agendaItems.filter(item => item.is_completed).length;
  const totalItems = agendaItems.length;
  const confirmedParticipants = participants.filter(p => p.confirmation_status === 'confirmed').length;

  return (
    <MainLayout>
      <div className="h-[calc(100vh-120px)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/meetings')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{meeting.title}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {format(new Date(meeting.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
                {meeting.meeting_rooms && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {meeting.meeting_rooms.name}
                  </span>
                )}
                {meeting.areas && (
                  <Badge variant="outline">{meeting.areas.name}</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant={meeting.status === 'Em Andamento' ? 'default' : 'secondary'}
              className="text-sm"
            >
              {meeting.status}
            </Badge>
            {meeting.meeting_rooms?.teams_link && (
              <Button variant="outline" onClick={openTeamsLink}>
                <Video className="mr-2 h-4 w-4" />
                Abrir Teams
                <ExternalLink className="ml-2 h-3 w-3" />
              </Button>
            )}
            <Button 
              onClick={handleFinalizeMeeting}
              disabled={finalizingMeeting}
            >
              {finalizingMeeting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Finalizar Reunião
            </Button>
          </div>
        </div>

        {/* Main content - 3 column layout */}
        <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
          {/* Left column - Agenda */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Pauta
                </CardTitle>
                <Badge variant="outline">
                  {completedItems}/{totalItems}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                {agendaItems.length > 0 ? (
                  <div className="space-y-3">
                    {agendaItems.map((item, index) => (
                      <div 
                        key={item.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                          item.is_completed 
                            ? 'bg-muted/50 border-muted' 
                            : 'bg-card border-border hover:border-primary/50'
                        }`}
                      >
                        <Checkbox
                          checked={item.is_completed}
                          onCheckedChange={() => toggleAgendaItem(item.id, item.is_completed)}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <p className={`text-sm ${item.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                            {index + 1}. {item.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum item na pauta
                  </p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Center column - Transcription */}
          {meeting.ai_mode !== 'Desabilitado' && (
            <RealtimeTranscription
              meetingId={meeting.id}
              onTranscriptionUpdate={setTranscription}
              onSave={(text) => setTranscription(text)}
            />
          )}

          {/* Right column - Participants & Info */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Participantes
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Confirmados</span>
                    <Badge variant="outline">
                      {confirmedParticipants}/{participants.length}
                    </Badge>
                  </div>
                  <Separator />
                  {participants.length > 0 ? (
                    <div className="space-y-2">
                      {participants.map((participant) => (
                        <div 
                          key={participant.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                              {participant.first_name?.[0] || '?'}
                            </div>
                            <span className="text-sm">
                              {participant.first_name} {participant.last_name}
                            </span>
                          </div>
                          <Badge 
                            variant={participant.confirmation_status === 'confirmed' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {participant.confirmation_status === 'confirmed' 
                              ? 'Confirmado' 
                              : participant.confirmation_status === 'declined'
                              ? 'Recusou'
                              : 'Pendente'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8 text-sm">
                      Nenhum participante
                    </p>
                  )}
                </div>

                {meeting.ai_mode === 'Obrigatório' && (
                  <>
                    <Separator className="my-4" />
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                        ⚠️ Transcrição Obrigatória
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Esta reunião requer transcrição completa antes de ser finalizada.
                      </p>
                    </div>
                  </>
                )}

                {meeting.description && (
                  <>
                    <Separator className="my-4" />
                    <div>
                      <h4 className="text-sm font-medium mb-2">Descrição</h4>
                      <p className="text-sm text-muted-foreground">
                        {meeting.description}
                      </p>
                    </div>
                  </>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
