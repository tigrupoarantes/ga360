import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

const events = [
  { date: 15, title: 'Reunião Estratégica', type: 'meeting', color: 'bg-primary' },
  { date: 16, title: 'Ritmo Trade', type: 'meeting', color: 'bg-secondary' },
  { date: 18, title: 'Entrega Relatório', type: 'task', color: 'bg-accent' },
  { date: 20, title: 'Processo Semanal', type: 'process', color: 'bg-info' },
];

const getDaysInMonth = () => {
  const year = 2024;
  const month = 0; // Janeiro
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const days = [];
  // Dias vazios antes do primeiro dia
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  // Dias do mês
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }
  return days;
};

export default function Calendar() {
  const days = getDaysInMonth();
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Calendário Corporativo</h1>
            <p className="text-muted-foreground mt-1">
              Visualize reuniões, processos e prazos
            </p>
          </div>
          <Button className="gap-2">
            <CalendarIcon className="h-4 w-4" />
            Hoje
          </Button>
        </div>

        {/* Calendar Header */}
        <Card className="p-6 animate-fade-in-up">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">Janeiro 2024</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="icon">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Week days header */}
            {weekDays.map((day) => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {days.map((day, index) => {
              const dayEvents = day ? events.filter(e => e.date === day) : [];
              const isToday = day === 15;

              return (
                <div
                  key={index}
                  className={`min-h-[100px] p-2 rounded-lg border transition-fast cursor-pointer ${
                    day
                      ? 'border-border hover:border-primary/50 bg-card'
                      : 'border-transparent'
                  } ${isToday ? 'border-primary bg-primary/5' : ''}`}
                >
                  {day && (
                    <>
                      <div className={`text-sm font-medium mb-2 ${
                        isToday ? 'text-primary' : 'text-foreground'
                      }`}>
                        {day}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.map((event, i) => (
                          <div
                            key={i}
                            className={`text-xs px-2 py-1 rounded ${event.color} text-white truncate`}
                          >
                            {event.title}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Legend */}
        <Card className="p-6 animate-fade-in-up">
          <h3 className="text-sm font-semibold text-foreground mb-3">Legenda</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground">Reuniões Estratégicas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-secondary" />
              <span className="text-sm text-muted-foreground">Reuniões Operacionais</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-accent" />
              <span className="text-sm text-muted-foreground">Prazos de Tarefas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-info" />
              <span className="text-sm text-muted-foreground">Execução de Processos</span>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
