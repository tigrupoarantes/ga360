import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { AnalyticsFilters, DateRange } from "@/components/analytics/AnalyticsFilters";
import { AnalyticsKPIGrid } from "@/components/analytics/AnalyticsKPIGrid";
import { MeetingsAnalytics } from "@/components/analytics/MeetingsAnalytics";
import { TasksAnalytics } from "@/components/analytics/TasksAnalytics";
import { ParticipationAnalytics } from "@/components/analytics/ParticipationAnalytics";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, ListTodo, Users, LayoutDashboard } from "lucide-react";

export default function Analytics() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().setMonth(new Date().getMonth() - 3)),
    to: new Date(),
  });
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold text-foreground">Analytics & BI</h1>
          <p className="text-muted-foreground mt-1">
            Análise avançada de dados com KPIs dinâmicos e visualizações interativas
          </p>
        </div>

        {/* Filters */}
        <AnalyticsFilters
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          selectedCompanyId={selectedCompanyId}
          onCompanyChange={setSelectedCompanyId}
          selectedAreaId={selectedAreaId}
          onAreaChange={setSelectedAreaId}
        />

        {/* KPI Grid */}
        <AnalyticsKPIGrid
          dateRange={dateRange}
          companyId={selectedCompanyId}
          areaId={selectedAreaId}
        />

        {/* Detailed Analytics Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Visão Geral</span>
            </TabsTrigger>
            <TabsTrigger value="meetings" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Reuniões</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              <span className="hidden sm:inline">Tarefas</span>
            </TabsTrigger>
            <TabsTrigger value="participation" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Participação</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <MeetingsAnalytics
                dateRange={dateRange}
                companyId={selectedCompanyId}
                areaId={selectedAreaId}
                compact
              />
              <TasksAnalytics
                dateRange={dateRange}
                companyId={selectedCompanyId}
                areaId={selectedAreaId}
                compact
              />
            </div>
            <ParticipationAnalytics
              dateRange={dateRange}
              companyId={selectedCompanyId}
              areaId={selectedAreaId}
              compact
            />
          </TabsContent>

          <TabsContent value="meetings">
            <MeetingsAnalytics
              dateRange={dateRange}
              companyId={selectedCompanyId}
              areaId={selectedAreaId}
            />
          </TabsContent>

          <TabsContent value="tasks">
            <TasksAnalytics
              dateRange={dateRange}
              companyId={selectedCompanyId}
              areaId={selectedAreaId}
            />
          </TabsContent>

          <TabsContent value="participation">
            <ParticipationAnalytics
              dateRange={dateRange}
              companyId={selectedCompanyId}
              areaId={selectedAreaId}
            />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
