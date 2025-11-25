import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus } from 'lucide-react';
import { MeetingRoomsList } from '@/components/meetings/MeetingRoomsList';
import { MeetingFormDialog } from '@/components/meetings/MeetingFormDialog';
import { MeetingCard } from '@/components/meetings/MeetingCard';
import { AtaViewer } from '@/components/meetings/AtaViewer';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function Meetings() {
  const { toast } = useToast();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ataViewerOpen, setAtaViewerOpen] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);

  const fetchMeetings = async () => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select(`
          *,
          meeting_rooms(name, teams_link),
          areas(name)
        `)
        .order('scheduled_at', { ascending: false });

      if (error) throw error;
      setMeetings(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar reuniões",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const handleStart = async (meetingId: string) => {
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ status: 'Em Andamento' })
        .eq('id', meetingId);

      if (error) throw error;

      toast({
        title: "Reunião iniciada",
        description: "A reunião foi marcada como em andamento.",
      });

      fetchMeetings();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleViewAta = (meetingId: string) => {
    setSelectedMeetingId(meetingId);
    setAtaViewerOpen(true);
  };

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Reuniões</h1>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Reunião
          </Button>
        </div>

        <Tabs defaultValue="meetings" className="space-y-4">
          <TabsList>
            <TabsTrigger value="meetings">Reuniões</TabsTrigger>
            <TabsTrigger value="rooms">Salas de Reunião</TabsTrigger>
          </TabsList>

          <TabsContent value="meetings" className="space-y-4">
            {loading ? (
              <div className="text-center py-12">Carregando reuniões...</div>
            ) : meetings.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground mb-4">
                    Nenhuma reunião agendada
                  </p>
                  <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Criar primeira reunião
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {meetings.map((meeting) => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    onStart={handleStart}
                    onViewAta={handleViewAta}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rooms">
            <MeetingRoomsList />
          </TabsContent>
        </Tabs>

        <MeetingFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={fetchMeetings}
        />

        {selectedMeetingId && (
          <AtaViewer
            open={ataViewerOpen}
            onOpenChange={setAtaViewerOpen}
            meetingId={selectedMeetingId}
          />
        )}
      </div>
    </MainLayout>
  );
}
