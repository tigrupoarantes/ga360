import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Search, 
  Calendar,
  Users,
  Sparkles,
  FileText
} from "lucide-react";

const meetings = [
  {
    id: 1,
    title: 'Reunião Estratégica Q1 2024',
    type: 'Estratégica',
    area: 'Diretoria',
    date: '2024-01-15',
    time: '14:00',
    participants: 8,
    aiMode: 'Obrigatória',
    status: 'Agendada',
    hasAta: false,
  },
  {
    id: 2,
    title: 'Ritmo Operacional - Trade Marketing',
    type: 'Operacional',
    area: 'Trade',
    date: '2024-01-16',
    time: '09:00',
    participants: 5,
    aiMode: 'Opcional',
    status: 'Agendada',
    hasAta: false,
  },
  {
    id: 3,
    title: 'Review Semanal - KPIs',
    type: 'Tática',
    area: 'Comercial',
    date: '2024-01-12',
    time: '15:30',
    participants: 6,
    aiMode: 'Obrigatória',
    status: 'Concluída',
    hasAta: true,
  },
];

const aiModeColors = {
  'Obrigatória': 'bg-primary text-primary-foreground',
  'Opcional': 'bg-accent text-accent-foreground',
  'Desativada': 'bg-muted text-muted-foreground',
};

const statusColors = {
  'Agendada': 'bg-info text-info-foreground',
  'Em Andamento': 'bg-warning text-warning-foreground',
  'Concluída': 'bg-success text-success-foreground',
  'Cancelada': 'bg-destructive text-destructive-foreground',
};

export default function Meetings() {
  return (
    <MainLayout userRole="Gerente">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Reuniões</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie reuniões, transcrições e ATAs inteligentes
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Reunião
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4 animate-fade-in-up">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[240px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar reuniões..."
                  className="pl-10"
                />
              </div>
            </div>
            <Button variant="outline">
              Tipo
            </Button>
            <Button variant="outline">
              Área
            </Button>
            <Button variant="outline">
              Status
            </Button>
            <Button variant="outline">
              <Calendar className="h-4 w-4 mr-2" />
              Data
            </Button>
          </div>
        </Card>

        {/* Meetings List */}
        <div className="space-y-4">
          {meetings.map((meeting) => (
            <Card 
              key={meeting.id}
              className="p-6 hover:shadow-card-hover transition-smooth cursor-pointer animate-fade-in-up"
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground">
                        {meeting.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="outline">{meeting.type}</Badge>
                        <Badge variant="outline">{meeting.area}</Badge>
                        <Badge className={aiModeColors[meeting.aiMode as keyof typeof aiModeColors]}>
                          <Sparkles className="h-3 w-3 mr-1" />
                          IA {meeting.aiMode}
                        </Badge>
                      </div>
                    </div>
                    <Badge className={statusColors[meeting.status as keyof typeof statusColors]}>
                      {meeting.status}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 mt-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(meeting.date).toLocaleDateString('pt-BR')} às {meeting.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>{meeting.participants} participantes</span>
                    </div>
                    {meeting.hasAta && (
                      <div className="flex items-center gap-2 text-success">
                        <FileText className="h-4 w-4" />
                        <span>ATA disponível</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    {meeting.status === 'Agendada' && (
                      <Button size="sm">Iniciar Reunião</Button>
                    )}
                    {meeting.status === 'Concluída' && meeting.hasAta && (
                      <>
                        <Button size="sm" variant="outline">Ver ATA</Button>
                        <Button size="sm" variant="outline">Ver Transcrição</Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost">Editar</Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
