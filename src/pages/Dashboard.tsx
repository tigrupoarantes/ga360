import { MainLayout } from "@/components/layout/MainLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp,
  Calendar,
  Target
} from "lucide-react";
import { Card } from "@/components/ui/card";

export default function Dashboard() {
  return (
    <MainLayout userRole="Gerente">
      <div className="space-y-6">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold text-foreground">Dashboard Executivo</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral do planejamento estratégico e execução operacional
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Reuniões do Mês"
            value="24"
            description="18 concluídas"
            icon={Users}
            variant="primary"
            trend={{ value: 12, isPositive: true }}
          />
          <StatsCard
            title="Tarefas Concluídas"
            value="156"
            description="87% do planejado"
            icon={CheckCircle2}
            variant="secondary"
            trend={{ value: 8, isPositive: true }}
          />
          <StatsCard
            title="Tarefas Atrasadas"
            value="8"
            description="Requer atenção"
            icon={AlertCircle}
            variant="accent"
          />
          <StatsCard
            title="Aderência aos Rituais"
            value="94%"
            description="Meta: 90%"
            icon={Target}
            variant="primary"
            trend={{ value: 4, isPositive: true }}
          />
        </div>

        {/* Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* KPIs Chart Placeholder */}
          <Card className="lg:col-span-2 p-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground">Progresso por Pilar</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Último trimestre</span>
              </div>
            </div>
            <div className="flex items-center justify-center h-64 bg-muted/30 rounded-lg">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Gráficos de KPI em desenvolvimento</p>
              </div>
            </div>
          </Card>

          {/* Recent Activity */}
          <RecentActivity />
        </div>

        {/* Bottom Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Próximas Reuniões */}
          <Card className="p-6 animate-fade-in-up">
            <h3 className="text-lg font-semibold text-foreground mb-4">Próximas Reuniões</h3>
            <div className="space-y-3">
              {[
                { title: 'Reunião Estratégica - Marketing', date: 'Hoje, 14:00', area: 'Marketing' },
                { title: 'Ritmo Operacional - Trade', date: 'Amanhã, 09:00', area: 'Trade' },
                { title: 'Review Mensal - Financeiro', date: 'Sex, 15:00', area: 'Financeiro' },
              ].map((meeting, i) => (
                <div 
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-fast cursor-pointer"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
                    <Users className="h-5 w-5 text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {meeting.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {meeting.date} • {meeting.area}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* MCI Radar */}
          <Card className="p-6 animate-fade-in-up">
            <h3 className="text-lg font-semibold text-foreground mb-4">MCI - Indicador Consolidado</h3>
            <div className="flex flex-col items-center justify-center h-48">
              <div className="relative">
                <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary">
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-card">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-primary">87</p>
                      <p className="text-xs text-muted-foreground">MCI</p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Meta: 85 • Acima da expectativa
              </p>
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
