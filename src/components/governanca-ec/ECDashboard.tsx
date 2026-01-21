import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Shield, 
  DollarSign, 
  Users, 
  Scale, 
  FileSearch,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ECStatusBadge } from "./ECStatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isAfter, isBefore, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const areaIcons: Record<string, React.ElementType> = {
  'governanca': Shield,
  'financeiro': DollarSign,
  'pessoas-cultura': Users,
  'juridico': Scale,
  'auditoria': FileSearch,
};

export function ECDashboard() {
  const navigate = useNavigate();

  const { data: areas, isLoading: areasLoading } = useQuery({
    queryKey: ['ec-areas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ec_areas')
        .select('*')
        .eq('is_active', true)
        .order('order');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['ec-dashboard-stats'],
    queryFn: async () => {
      const { data: records, error } = await supabase
        .from('ec_card_records')
        .select('status, due_date');
      
      if (error) throw error;

      const today = new Date();
      const pending = records?.filter(r => r.status === 'pending').length || 0;
      const inProgress = records?.filter(r => r.status === 'in_progress').length || 0;
      const atRisk = records?.filter(r => r.status === 'at_risk').length || 0;
      const overdue = records?.filter(r => r.status === 'overdue').length || 0;
      const completed = records?.filter(r => r.status === 'completed' || r.status === 'reviewed').length || 0;

      return { pending, inProgress, atRisk, overdue, completed, total: records?.length || 0 };
    },
  });

  const { data: upcomingDueDates } = useQuery({
    queryKey: ['ec-upcoming-due-dates'],
    queryFn: async () => {
      const today = new Date();
      const nextWeek = addDays(today, 7);

      const { data, error } = await supabase
        .from('ec_card_records')
        .select(`
          id,
          due_date,
          status,
          competence,
          card:ec_cards(id, title, area:ec_areas(slug, name))
        `)
        .gte('due_date', format(today, 'yyyy-MM-dd'))
        .lte('due_date', format(nextWeek, 'yyyy-MM-dd'))
        .not('status', 'in', '("completed","reviewed")')
        .order('due_date')
        .limit(5);
      
      if (error) throw error;
      return data;
    },
  });

  if (areasLoading || statsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-5">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="p-4 border-l-4 border-l-muted-foreground">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{stats?.pending || 0}</p>
              <p className="text-sm text-muted-foreground">Pendentes</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-primary">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{stats?.inProgress || 0}</p>
              <p className="text-sm text-muted-foreground">Em Andamento</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-yellow-500">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{stats?.atRisk || 0}</p>
              <p className="text-sm text-muted-foreground">Em Risco</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-destructive">
          <div className="flex items-center gap-3">
            <XCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{stats?.overdue || 0}</p>
              <p className="text-sm text-muted-foreground">Atrasados</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-green-500">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{stats?.completed || 0}</p>
              <p className="text-sm text-muted-foreground">Concluídos</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Próximos vencimentos */}
      {upcomingDueDates && upcomingDueDates.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            Próximos Vencimentos (7 dias)
          </h3>
          <div className="space-y-2">
            {upcomingDueDates.map((record: any) => (
              <div 
                key={record.id}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer"
                onClick={() => navigate(`/governanca-ec/${record.card?.area?.slug}/${record.card?.id}`)}
              >
                <div className="flex items-center gap-3">
                  <ECStatusBadge status={record.status} size="sm" />
                  <span className="font-medium">{record.card?.title}</span>
                  <span className="text-sm text-muted-foreground">({record.competence})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {record.due_date && format(new Date(record.due_date), "dd/MM", { locale: ptBR })}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Áreas */}
      <div className="grid gap-4 md:grid-cols-5">
        {areas?.map((area) => {
          const Icon = areaIcons[area.slug] || Shield;
          return (
            <Card 
              key={area.id}
              className="p-4 cursor-pointer hover:border-primary/50 transition-all"
              onClick={() => navigate(`/governanca-ec/${area.slug}`)}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{area.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{area.description}</p>
                </div>
                <Button variant="ghost" size="sm" className="mt-2">
                  Ver cards <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
