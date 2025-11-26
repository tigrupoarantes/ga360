import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Clock, ExternalLink, Play, FileText, Upload, MessageSquare, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RecordingUpload } from "./RecordingUpload";
import { TranscriptionViewer } from "./TranscriptionViewer";
import { MeetingParticipants } from "./MeetingParticipants";

interface MeetingCardProps {
  meeting: {
    id: string;
    title: string;
    type: string;
    scheduled_at: string;
    duration_minutes: number;
    status: string;
    ai_mode: string;
    meeting_rooms?: { name: string; teams_link: string };
    areas?: { name: string };
  };
  onStart?: (id: string) => void;
  onViewAta?: (id: string) => void;
}

const statusColors: Record<string, string> = {
  "Agendada": "bg-blue-500",
  "Em Andamento": "bg-green-500",
  "Concluída": "bg-gray-500",
  "Cancelada": "bg-red-500",
};

const aiModeColors: Record<string, string> = {
  "Obrigatória": "bg-red-500",
  "Opcional": "bg-yellow-500",
  "Desativada": "bg-gray-500",
};

export function MeetingCard({ meeting, onStart, onViewAta }: MeetingCardProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [transcriptionOpen, setTranscriptionOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  
  const scheduledDate = new Date(meeting.scheduled_at);
  const canStart = meeting.status === "Agendada";
  const hasAta = meeting.status === "Concluída";
  const canUpload = meeting.status === "Em Andamento" || meeting.status === "Concluída";

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">{meeting.title}</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant="outline">{meeting.type}</Badge>
              {meeting.areas && <Badge variant="secondary">{meeting.areas.name}</Badge>}
              <Badge className={aiModeColors[meeting.ai_mode]}>
                🤖 {meeting.ai_mode}
              </Badge>
            </div>
          </div>
          <Badge className={statusColors[meeting.status]}>
            {meeting.status}
          </Badge>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{format(scheduledDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>{meeting.duration_minutes} minutos</span>
          </div>
          {meeting.meeting_rooms && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>{meeting.meeting_rooms.name}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {canStart && (
            <Button
              size="sm"
              onClick={() => onStart?.(meeting.id)}
            >
              <Play className="h-4 w-4 mr-1" />
              Iniciar
            </Button>
          )}
          
          {meeting.meeting_rooms && (
            <Button
              size="sm"
              className="bg-[#0078D4] hover:bg-[#106EBE] text-white"
              onClick={() => window.open(meeting.meeting_rooms!.teams_link, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Microsoft Teams
            </Button>
          )}
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => setParticipantsOpen(true)}
          >
            <UserPlus className="h-4 w-4 mr-1" />
            Participantes
          </Button>

          {canUpload && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setUploadOpen(true)}
              >
                <Upload className="h-4 w-4 mr-1" />
                Upload
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTranscriptionOpen(true)}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                Transcrição
              </Button>
            </>
          )}
          {hasAta && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onViewAta?.(meeting.id)}
            >
              <FileText className="h-4 w-4 mr-1" />
              Ver ATA
            </Button>
          )}
        </div>

        <MeetingParticipants
          open={participantsOpen}
          onOpenChange={setParticipantsOpen}
          meetingId={meeting.id}
          meetingTitle={meeting.title}
          meetingDate={meeting.scheduled_at}
        />

        <RecordingUpload
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          meetingId={meeting.id}
          onSuccess={() => {}}
        />

        <TranscriptionViewer
          open={transcriptionOpen}
          onOpenChange={setTranscriptionOpen}
          meetingId={meeting.id}
        />
      </CardContent>
    </Card>
  );
}
