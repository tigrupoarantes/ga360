import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ECStatusBadge, ECStatus } from "./ECStatusBadge";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, ArrowRight, ListTodo, MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCardPermissions } from "@/hooks/useCardPermissions";

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
  onEdit?: (card: any) => void;
  onDelete?: (card: any) => void;
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

export function ECCard({ card, record, viewMode, onEdit, onDelete }: ECCardProps) {
  const navigate = useNavigate();
  const { areaSlug } = useParams();
  const { hasCardPermission } = useCardPermissions();
  const canManage = hasCardPermission(card.id, 'manage');

  // Buscar contagem de tarefas pendentes
  const { data: pendingTasksCount } = useQuery({
    queryKey: ['ec-card-pending-tasks-count', card.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('ec_card_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('card_id', card.id)
        .in('status', ['pending', 'in_progress']);
      if (error) throw error;
      return count || 0;
    },
  });

  const responsibleName = card.responsible 
    ? `${card.responsible.first_name} ${card.responsible.last_name}`.trim() || 'Sem nome'
    : 'Não atribuído';

  const responsibleInitials = card.responsible
    ? `${card.responsible.first_name?.[0] || ''}${card.responsible.last_name?.[0] || ''}`
    : '?';

  const canView = hasCardPermission(card.id, 'view');

  const handleClick = () => {
    // Block navigation if user doesn't have view permission
    if (!canView) return;

    // Special handling for "Auditoria de Estoque" card
    const isStockAuditCard = card.title.toLowerCase().includes('auditoria de estoque') || 
                              card.title.toLowerCase().includes('estoque') && 
                              card.title.toLowerCase().includes('auditoria');
    if (isStockAuditCard) {
      navigate('/governanca-ec/auditoria/estoque');
      return;
    }

    // Special handling for QLP card
    const titleLower = card.title.toLowerCase();
    const isQLPCard = titleLower.includes('qlp') || 
                      titleLower.includes('quadro de lotação') || 
                      titleLower.includes('quadro de lotacao');
    if (isQLPCard) {
      navigate('/governanca-ec/pessoas-cultura/qlp');
      return;
    }

    // Special handling for Controle PJ card
    const isControlePJCard = titleLower.includes('controle pj') || titleLower.includes('controle de pj');
    if (isControlePJCard) {
      navigate('/governanca-ec/pessoas-cultura/controle-pj');
      return;
    }

    // Special handling for VERBAS INDENIZATÓRIAS card (deve vir antes do check de verbas genérico)
    const isVerbasIndenizatoriasCard = titleLower.includes('indenizat');
    if (isVerbasIndenizatoriasCard) {
      navigate('/governanca-ec/pessoas-cultura/verbas-indenizatorias');
      return;
    }

    // Special handling for VERBAS card
    const isVerbasCard = titleLower === 'verbas' || titleLower.includes('verbas');
    if (isVerbasCard) {
      navigate('/governanca-ec/pessoas-cultura/verbas');
      return;
    }
    
    navigate(`/governanca-ec/${areaSlug}/${card.id}`);
  };

  const handleTasksClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/governanca-ec/${areaSlug}/${card.id}?tab=tasks`);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(card);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(card);
  };

  const ActionsMenu = () => {
    if (!canManage) return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  if (viewMode === 'list') {
    return (
      <Card 
        className={`p-4 transition-all ${canView ? 'cursor-pointer hover:border-primary/50' : 'opacity-50 cursor-not-allowed'}`}
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

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="text-xs bg-muted px-2 py-0.5 rounded">
                {periodicityLabels[card.periodicity_type] || card.periodicity_type}
              </span>
              {pendingTasksCount !== undefined && pendingTasksCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs bg-warning/10 text-warning hover:bg-warning/20 hover:text-warning"
                  onClick={handleTasksClick}
                >
                  <ListTodo className="h-3 w-3 mr-1" />
                  {pendingTasksCount} tarefa{pendingTasksCount > 1 ? 's' : ''}
                </Button>
              )}
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

            <ActionsMenu />
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </Card>
    );
  }

  // Grid view
  return (
    <Card 
      className={`p-4 transition-all flex flex-col ${canView ? 'cursor-pointer hover:border-primary/50' : 'opacity-50 cursor-not-allowed'}`}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <ECStatusBadge status={record?.status || 'pending'} size="sm" />
          {pendingTasksCount !== undefined && pendingTasksCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-xs bg-warning/10 text-warning hover:bg-warning/20 hover:text-warning"
              onClick={handleTasksClick}
            >
              <ListTodo className="h-3 w-3 mr-0.5" />
              {pendingTasksCount}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs bg-muted px-2 py-0.5 rounded">
            {periodicityLabels[card.periodicity_type] || card.periodicity_type}
          </span>
          <ActionsMenu />
        </div>
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
