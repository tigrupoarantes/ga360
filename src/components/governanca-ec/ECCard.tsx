import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ECStatusBadge, ECStatus } from "./ECStatusBadge";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, User, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ECCardProps {
  card: {
    id: string;
    title: string;
    description?: string;
    periodicity_type: string;
    responsible?: {
      id: string;
      first_name: string;
      last_name: string;
      avatar_url?: string;
    } | null;
  };
  record?: {
    id: string;
    status: ECStatus;
    due_date?: string;
    competence: string;
    updated_at: string;
  } | null;
  viewMode: 'grid' | 'list';
}

const periodicityLabels: Record<string, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
  manual_trigger: 'Manual',
};

export function ECCard({ card, record, viewMode }: ECCardProps) {
  const navigate = useNavigate();
  const { areaSlug } = useParams();

  const responsibleName = card.responsible 
    ? `${card.responsible.first_name} ${card.responsible.last_name}`.trim() || 'Sem nome'
    : 'Não atribuído';

  const responsibleInitials = card.responsible
    ? `${card.responsible.first_name?.[0] || ''}${card.responsible.last_name?.[0] || ''}`
    : '?';

  const handleClick = () => {
    navigate(`/governanca-ec/${areaSlug}/${card.id}`);
  };

  if (viewMode === 'list') {
    return (
      <Card 
        className="p-4 cursor-pointer hover:border-primary/50 transition-all"
        onClick={handleClick}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <ECStatusBadge status={record?.status || 'pending'} size="sm" />
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{card.title}</h3>
              <p className="text-sm text-muted-foreground truncate">{card.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="text-xs bg-muted px-2 py-0.5 rounded">
                {periodicityLabels[card.periodicity_type] || card.periodicity_type}
              </span>
            </div>

            {record?.due_date && (
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(record.due_date), "dd/MM/yyyy", { locale: ptBR })}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={card.responsible?.avatar_url} />
                <AvatarFallback className="text-xs">{responsibleInitials}</AvatarFallback>
              </Avatar>
              <span className="hidden md:inline">{responsibleName}</span>
            </div>

            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </Card>
    );
  }

  // Grid view
  return (
    <Card 
      className="p-4 cursor-pointer hover:border-primary/50 transition-all flex flex-col"
      onClick={handleClick}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <ECStatusBadge status={record?.status || 'pending'} size="sm" />
        <span className="text-xs bg-muted px-2 py-0.5 rounded">
          {periodicityLabels[card.periodicity_type] || card.periodicity_type}
        </span>
      </div>

      <h3 className="font-semibold mb-1">{card.title}</h3>
      <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
        {card.description || 'Sem descrição'}
      </p>

      <div className="mt-4 pt-3 border-t flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={card.responsible?.avatar_url} />
            <AvatarFallback className="text-xs">{responsibleInitials}</AvatarFallback>
          </Avatar>
          <span className="truncate max-w-24">{responsibleName}</span>
        </div>

        {record?.due_date && (
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{format(new Date(record.due_date), "dd/MM", { locale: ptBR })}</span>
          </div>
        )}
      </div>

      {record?.updated_at && (
        <p className="text-xs text-muted-foreground mt-2">
          Atualizado em {format(new Date(record.updated_at), "dd/MM HH:mm", { locale: ptBR })}
        </p>
      )}
    </Card>
  );
}
