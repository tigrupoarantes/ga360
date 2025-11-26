import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Repeat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Meeting {
  id: string;
  title: string;
  type: string;
  scheduled_at: string;
  recurrence_type: string;
  meeting_rooms?: { name: string };
}

const getDaysInMonth = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }
  return days;
};

const getMeetingColor = (type: string) => {
  const colors: Record<string, string> = {
    'Estratégica': 'bg-primary',
    'Tática': 'bg-secondary',
    'Operacional': 'bg-accent',
    'Trade': 'bg-chart-4',
  };
  return colors[type] || 'bg-muted';
};

export default function Calendar() {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days = getDaysInMonth(year, month);
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const startOfMonth = new Date(year, month, 1).toISOString();
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

      const { data, error } = await supabase
        .from("meetings")
        .select("id, title, type, scheduled_at, recurrence_type, meeting_rooms(name)")
        .gte("scheduled_at", startOfMonth)
        .lte("scheduled_at", endOfMonth)
        .order("scheduled_at");

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
  }, [currentDate]);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getMeetingsForDay = (day: number) => {
    return meetings.filter(meeting => {
      const meetingDate = new Date(meeting.scheduled_at);
      return meetingDate.getDate() === day &&
             meetingDate.getMonth() === month &&
             meetingDate.getFullYear() === year;
    });
  };

  const today = new Date();
  const isToday = (day: number) => {
    return day === today.getDate() &&
           month === today.getMonth() &&
           year === today.getFullYear();
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Calendário Corporativo</h1>
            <p className="text-muted-foreground mt-1">
              Visualize reuniões agendadas
            </p>
          </div>
          <Button onClick={goToToday} className="gap-2">
            <CalendarIcon className="h-4 w-4" />
            Hoje
          </Button>
        </div>

        <Card className="p-6 animate-fade-in-up">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={goToNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Carregando reuniões...
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day) => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}

              {days.map((day, index) => {
                const dayMeetings = day ? getMeetingsForDay(day) : [];
                const isTodayDay = day && isToday(day);

                return (
                  <div
                    key={index}
                    className={`min-h-[100px] p-2 rounded-lg border transition-fast cursor-pointer ${
                      day
                        ? 'border-border hover:border-primary/50 bg-card'
                        : 'border-transparent'
                    } ${isTodayDay ? 'border-primary bg-primary/5' : ''}`}
                  >
                    {day && (
                      <>
                        <div className={`text-sm font-medium mb-2 ${
                          isTodayDay ? 'text-primary' : 'text-foreground'
                        }`}>
                          {day}
                        </div>
                        <div className="space-y-1">
                          {dayMeetings.map((meeting) => (
                            <div
                              key={meeting.id}
                              className={`text-xs px-2 py-1 rounded ${getMeetingColor(meeting.type)} text-white truncate flex items-center gap-1`}
                              title={`${meeting.title} - ${meeting.meeting_rooms?.name || ''}`}
                            >
                              {meeting.recurrence_type !== 'none' && (
                                <Repeat className="h-2.5 w-2.5 flex-shrink-0" />
                              )}
                              <span className="truncate">{meeting.title}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-6 animate-fade-in-up">
          <h3 className="text-sm font-semibold text-foreground mb-3">Legenda</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground">Reuniões Estratégicas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-secondary" />
              <span className="text-sm text-muted-foreground">Reuniões Táticas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-accent" />
              <span className="text-sm text-muted-foreground">Reuniões Operacionais</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-chart-4" />
              <span className="text-sm text-muted-foreground">Reuniões Trade</span>
            </div>
            <div className="flex items-center gap-2">
              <Repeat className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Reunião Recorrente</span>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}