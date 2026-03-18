import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Plus, RefreshCw, AlertTriangle, Building2 } from 'lucide-react';
import { VIStatusDashboard } from '@/components/verbas-indenizatorias/VIStatusDashboard';
import { VIFilters } from '@/components/verbas-indenizatorias/VIFilters';
import { VIDocumentTable } from '@/components/verbas-indenizatorias/VIDocumentTable';
import { VIGenerateDialog } from '@/components/verbas-indenizatorias/VIGenerateDialog';
import { useVerbasIndenizatorias, useVIAccountingGroups, type VIQueryFilters } from '@/hooks/useVerbasIndenizatorias';
import { resolveAccountingGroupLabel } from '@/lib/accountingGroups';
import { useCardPermissions } from '@/hooks/useCardPermissions';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useQuery } from '@tanstack/react-query';

export default function VerbasIndenizatorias() {
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();
  const { hasCardPermission, isSuperAdmin } = useCardPermissions();

  const [filters, setFilters] = useState<VIQueryFilters>({ page: 1, pageSize: 50 });
  const [generateOpen, setGenerateOpen] = useState(false);

  // Buscar UUID do card "Verbas Indenizatórias" para verificar permissão granular
  const { data: viCardId } = useQuery<string | null>({
    queryKey: ['ec-card-vi-id'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ec_cards')
        .select('id')
        .ilike('title', 'Verbas Indenizat%')
        .eq('is_active', true)
        .maybeSingle();
      return data?.id ?? null;
    },
    staleTime: 5 * 60_000,
  });

  const canFill = isSuperAdmin || (viCardId ? hasCardPermission(viCardId, 'fill') : false);

  const { data, isLoading, isFetching, isError, error, refetch } = useVerbasIndenizatorias(
    selectedCompanyId ?? null,
    filters,
  );

  const { data: accountingGroups = [] } = useVIAccountingGroups(
    selectedCompanyId ?? null,
    filters.competencia ?? '',
  );

  const documents = data?.rows ?? [];
  const total = data?.total ?? 0;

  function handleFiltersChange(newFilters: VIQueryFilters) {
    setFilters(newFilters);
  }

  function handlePageChange(page: number) {
    setFilters((prev) => ({ ...prev, page }));
  }

  function handleGroupCardClick(group: string) {
    setFilters((prev) => ({
      ...prev,
      accountingGroup: prev.accountingGroup === group ? undefined : group,
      page: 1,
    }));
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/governanca-ec/pessoas-cultura')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Verbas Indenizatórias</h1>
              <p className="text-sm text-muted-foreground">
                Geração e acompanhamento de documentos para assinatura digital via D4Sign
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>

            {canFill && (
              <Button size="sm" onClick={() => setGenerateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Gerar documento
              </Button>
            )}
          </div>
        </div>

        {/* Erro de carregamento */}
        {isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erro ao carregar documentos</AlertTitle>
            <AlertDescription>
              {(error as Error)?.message === 'forbidden'
                ? 'Você não tem permissão para acessar os documentos desta empresa. Solicite acesso ao administrador.'
                : (error as Error)?.message === 'invalid_token'
                ? 'Sessão expirada. Recarregue a página e faça login novamente.'
                : (error as Error)?.message
                  ? `Falha ao consultar documentos: ${(error as Error).message}`
                  : 'Não foi possível carregar os documentos. Verifique sua conexão e tente novamente.'}
            </AlertDescription>
          </Alert>
        )}

        {/* KPI cards */}
        <VIStatusDashboard documents={documents} total={total} />

        {/* Cards por grupo de contabilização */}
        {filters.competencia && accountingGroups.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Grupos de Contabilização</p>
            <div className="flex flex-wrap gap-3">
              {accountingGroups.map((group) => {
                const label = resolveAccountingGroupLabel(group);
                const docsInGroup = documents.filter(
                  (d) => d.employee_accounting_group === group,
                );
                const signedInGroup = docsInGroup.filter(
                  (d) => d.d4sign_status === 'signed',
                ).length;
                const pct = docsInGroup.length > 0
                  ? Math.round((signedInGroup / docsInGroup.length) * 100)
                  : 0;
                const isSelected = filters.accountingGroup === group;

                return (
                  <Card
                    key={group}
                    role="button"
                    tabIndex={0}
                    className={`p-3 cursor-pointer flex items-center gap-3 transition-all select-none
                      ${isSelected
                        ? 'border-primary ring-1 ring-primary'
                        : 'hover:border-primary/50'
                      }`}
                    onClick={() => handleGroupCardClick(group)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleGroupCardClick(group);
                      }
                    }}
                  >
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{label}</p>
                      <p className="text-xs text-muted-foreground">{docsInGroup.length} doc(s) na página</p>
                    </div>
                    <Badge
                      variant={pct === 100 && docsInGroup.length > 0 ? 'default' : 'secondary'}
                      className="ml-auto text-xs shrink-0"
                    >
                      {pct}% ass.
                    </Badge>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Filtros */}
        <VIFilters
          filters={filters}
          onChange={handleFiltersChange}
          companyId={selectedCompanyId ?? null}
        />

        {/* Tabela */}
        {isLoading ? (
          <div className="animate-pulse h-64 bg-muted rounded-lg" />
        ) : (
          <VIDocumentTable
            documents={documents}
            total={total}
            page={filters.page ?? 1}
            pageSize={filters.pageSize ?? 50}
            companyId={selectedCompanyId ?? ''}
            onPageChange={handlePageChange}
          />
        )}

        {/* Dialog de geração */}
        {selectedCompanyId && (
          <VIGenerateDialog
            companyId={selectedCompanyId}
            open={generateOpen}
            onClose={() => setGenerateOpen(false)}
          />
        )}
      </div>
    </MainLayout>
  );
}
