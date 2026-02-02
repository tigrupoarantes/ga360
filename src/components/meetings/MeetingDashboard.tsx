import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/external-client';
import { 
  Calendar, 
  CheckCircle, 
  FileText, 
  ListTodo, 
  Users,
  TrendingUp,
  Loader2 
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DashboardMetrics {
  totalMeetings: number;
  completedMeetings: number;
  totalParticipants: number;
  averageParticipation: number;
  atasGenerated: number;
  tasksCreated: number;
  completionRate: number;
}

interface MeetingTrend {
  month: string;
  total: number;
  completed: number;
}

interface MeetingByType {
  name: string;
  value: number;
}

export function MeetingDashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalMeetings: 0,
    completedMeetings: 0,
    totalParticipants: 0,
    averageParticipation: 0,
    atasGenerated: 0,
    tasksCreated: 0,
    completionRate: 0,
  });
  const [trendData, setTrendData] = useState<MeetingTrend[]>([]);
  const [typeData, setTypeData] = useState<MeetingByType[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Buscar todas as reuniões
      const { data: meetings, error: meetingsError } = await supabase
        .from('meetings')
        .select('id, type, status, scheduled_at, created_at');

      if (meetingsError) throw meetingsError;

      // Buscar participantes
      const { data: participants, error: participantsError } = await supabase
        .from('meeting_participants')
        .select('id, attended, meeting_id');

      if (participantsError) throw participantsError;

      // Buscar ATAs
      const { data: atas, error: atasError } = await supabase
        .from('meeting_atas')
        .select('id, status');

      if (atasError) throw atasError;

      // Buscar tarefas
      const { data: tasks, error: tasksError } = await supabase
        .from('meeting_tasks')
        .select('id, status');

      if (tasksError) throw tasksError;

      // Calcular métricas
      const totalMeetings = meetings?.length || 0;
      const completedMeetings = meetings?.filter(m => m.status === 'Concluída').length || 0;
      const totalParticipants = participants?.length || 0;
      const attendedCount = participants?.filter(p => p.attended).length || 0;
      const atasGenerated = atas?.length || 0;
      const tasksCreated = tasks?.length || 0;
      const completionRate = totalMeetings > 0 ? (completedMeetings / totalMeetings) * 100 : 0;
      const averageParticipation = totalParticipants > 0 ? (attendedCount / totalParticipants) * 100 : 0;

      setMetrics({
        totalMeetings,
        completedMeetings,
        totalParticipants,
        averageParticipation,
        atasGenerated,
        tasksCreated,
        completionRate,
      });

      // Calcular tendências mensais (últimos 6 meses)
      const monthlyData = calculateMonthlyTrends(meetings || []);
      setTrendData(monthlyData);

      // Calcular distribuição por tipo
      const typeDistribution = calculateTypeDistribution(meetings || []);
      setTypeData(typeDistribution);

    } catch (error: any) {
      toast({
        title: "Erro ao carregar dashboard",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateMonthlyTrends = (meetings: any[]): MeetingTrend[] => {
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const now = new Date();
    const trends: MeetingTrend[] = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      const monthMeetings = meetings.filter(m => {
        const meetingDate = new Date(m.scheduled_at);
        const meetingKey = `${meetingDate.getFullYear()}-${String(meetingDate.getMonth() + 1).padStart(2, '0')}`;
        return meetingKey === monthKey;
      });

      trends.push({
        month: `${monthNames[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`,
        total: monthMeetings.length,
        completed: monthMeetings.filter(m => m.status === 'Concluída').length,
      });
    }

    return trends;
  };

  const calculateTypeDistribution = (meetings: any[]): MeetingByType[] => {
    const types: Record<string, number> = {};
    
    meetings.forEach(meeting => {
      types[meeting.type] = (types[meeting.type] || 0) + 1;
    });

    return Object.entries(types).map(([name, value]) => ({ name, value }));
  };

  const COLORS = ['#0B3D91', '#007A7A', '#FFB400', '#10B981', '#6366F1'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Métricas Principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Reuniões</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalMeetings}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.completedMeetings} concluídas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conclusão</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.completionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Das reuniões agendadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ATAs Geradas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.atasGenerated}</div>
            <p className="text-xs text-muted-foreground">
              Documentos criados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tarefas Criadas</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.tasksCreated}</div>
            <p className="text-xs text-muted-foreground">
              De reuniões
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Segunda linha de métricas */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Participação Média</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.averageParticipation.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Taxa de presença dos participantes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Participantes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalParticipants}</div>
            <p className="text-xs text-muted-foreground">
              Em todas as reuniões
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Tendência Mensal */}
        <Card>
          <CardHeader>
            <CardTitle>Tendência de Reuniões (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#0B3D91" 
                  strokeWidth={2}
                  name="Total"
                />
                <Line 
                  type="monotone" 
                  dataKey="completed" 
                  stroke="#007A7A" 
                  strokeWidth={2}
                  name="Concluídas"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição por Tipo */}
        <Card>
          <CardHeader>
            <CardTitle>Reuniões por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Barras Comparativo */}
      <Card>
        <CardHeader>
          <CardTitle>Comparativo Mensal: Agendadas vs Concluídas</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#0B3D91" name="Agendadas" />
              <Bar dataKey="completed" fill="#007A7A" name="Concluídas" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
