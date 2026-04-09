import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Plus, RefreshCw, AlertTriangle, Building2, Users, CloudDownload, Send, RotateCcw } from 'lucide-react';
import { VIStatusDashboard } from '@/components/verbas-indenizatorias/VIStatusDashboard';
import { VIFilters } from '@/components/verbas-indenizatorias/VIFilters';
import { VIDocumentTable } from '@/components/verbas-indenizatorias/VIDocumentTable';
import { VIGenerateDialog } from '@/components/verbas-indenizatorias/VIGenerateDialog';
import { VIBatchGenerateDialog } from '@/components/verbas-indenizatorias/VIBatchGenerateDialog';
import { useVerbasIndenizatorias, useVICnpjGroups, type VIQueryFilters } from '@/hooks/useVerbasIndenizatorias';
import { useCardPermissions } from '@/hooks/useCardPermissions';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function VerbasIndenizatorias() {
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();
  const { hasCardPermission, isSuperAdmin } = useCardPermissions();

  const [filters, setFilters] = useState<VIQueryFilters>({ page: 1, pageSize: 50 });
  const [generateOpen, setGenerateOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sendingDrafts, setSendingDrafts] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

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

  const { data: cnpjGroups = [] } = useVICnpjGroups(
    selectedCompanyId ?? null,
    filters.competencia ?? '',
  );

  const documents = data?.rows ?? [];
  const total = data?.total ?? 0;

  // Conta drafts (total real via stats do servidor) e erros (da página atual, pois o reprocessamento opera na página)
  const draftCount = data?.stats?.pending ?? documents.filter((d: any) => ['draft', 'uploaded', 'signers_added'].includes(d.d4sign_status)).length;
  const errorCount = documents.filter((d: any) => d.d4sign_status === 'error').length;

  async function handleSendDrafts() {
    if (!selectedCompanyId || sendingDrafts) return;
    setSendingDrafts(true);

    let totalSent = 0;
    let totalAdvanced = 0;
    let totalErrors = 0;
    let consecutiveFailures = 0;

    const toastId = toast.loading(
      `Iniciando envio para D4Sign...`,
      { duration: Infinity },
    );

    // Loop automatico: processa 1 documento, 1 etapa por vez
    // Etapas: draft → uploaded → signers_added → sent_to_sign
    while (consecutiveFailures < 5) {
      try {
        const resp = await supabase.functions.invoke('send-drafts-to-d4sign', {
          body: { companyId: selectedCompanyId },
        });
        if (resp.error) throw resp.error;

        const result = resp.data;
        const sent = result?.sent ?? 0;
        const advanced = result?.advanced ?? 0;
        const errors = result?.errors ?? 0;
        const pending = result?.pending ?? 0;
        const action = result?.action ?? '';
        const name = result?.name ?? '';

        // Nada processado = acabaram os documentos pendentes
        if (advanced === 0 && errors === 0) break;

        totalSent += sent;
        totalAdvanced += advanced;
        totalErrors += errors;

        if (advanced === 0 && errors > 0) {
          consecutiveFailures++;
        } else {
          consecutiveFailures = 0;
        }

        const statusMsg = action === 'upload' ? 'Upload'
          : action === 'add_signer' ? 'Signatario'
          : action === 'send_to_sign' ? 'Enviado'
          : action;

        toast.loading(
          `D4Sign: ${name} → ${statusMsg} | ${totalSent} completo(s), ${pending} pendente(s)${totalErrors > 0 ? `, ${totalErrors} erro(s)` : ''}`,
          { id: toastId, duration: Infinity },
        );

        // Delay entre chamadas (2s — cada chamada faz so 1 acao)
        await new Promise(r => setTimeout(r, 2000));
      } catch (err: any) {
        consecutiveFailures++;
        totalErrors++;
        toast.loading(
          `Erro na chamada. ${totalSent} completo(s), ${totalErrors} erro(s). Tentando novamente...`,
          { id: toastId, duration: Infinity },
        );
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    // Toast final
    toast.dismiss(toastId);
    if (totalSent > 0 && totalErrors === 0) {
      toast.success(`Concluido! ${totalSent} documento(s) enviado(s) para D4Sign.`);
    } else if (totalSent > 0 || totalAdvanced > 0) {
      toast.warning(`${totalSent} enviado(s), ${totalAdvanced} etapa(s) avancada(s), ${totalErrors} erro(s).`);
    } else {
      toast.error(`Nenhum documento processado. ${totalErrors} erro(s). Verifique a conexao com D4Sign.`);
    }

    refetch();
    setSendingDrafts(false);
  }

  async function handleSyncD4Sign() {
    if (!selectedCompanyId || syncing) return;
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await supabase.functions.invoke('sync-d4sign-status', {
        body: { companyId: selectedCompanyId },
      });
      if (resp.error) throw resp.error;
      const result = resp.data;
      if (result?.synced > 0) {
        toast.success(`${result.synced} documento(s) atualizado(s)`);
        refetch();
      } else {
        toast.info('Nenhum documento atualizado — status ainda pendente na D4Sign');
      }
    } catch (err: any) {
      toast.error('Erro ao sincronizar: ' + (err?.message || 'falha na chamada'));
    } finally {
      setSyncing(false);
    }
  }

  async function handleReprocessErrors() {
    if (!selectedCompanyId || reprocessing) return;
    setReprocessing(true);

    const errorDocs = documents.filter((d: any) => d.d4sign_status === 'error');
    let reprocessed = 0;
    let failed = 0;

    const toastId = toast.loading(`Reprocessando 0 de ${errorDocs.length}...`, { duration: Infinity });

    for (const doc of errorDocs) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('Não autenticado');

        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reprocess-vi-error`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ documentId: doc.id, companyId: selectedCompanyId }),
          },
        );

        if (resp.ok) {
          reprocessed++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }

      toast.loading(
        `Reprocessando ${reprocessed + failed} de ${errorDocs.length}...`,
        { id: toastId, duration: Infinity },
      );
    }

    toast.dismiss(toastId);
    if (reprocessed > 0 && failed === 0) {
      toast.success(`${reprocessed} documento(s) preparado(s). Clique em "Enviar rascunhos" para processá-los.`);
    } else if (reprocessed > 0) {
      toast.warning(`${reprocessed} preparado(s), ${failed} não puderam ser reprocessados (verifique o email do signatário).`);
    } else {
      toast.error(`Nenhum documento reprocessado. Verifique os detalhes de cada erro.`);
    }

    refetch();
    setReprocessing(false);
  }

  function handleFiltersChange(newFilters: VIQueryFilters) {
    setFilters(newFilters);
  }

  function handlePageChange(page: number) {
    setFilters((prev) => ({ ...prev, page }));
  }

  function handleCnpjCardClick(cnpj: string) {
    setFilters((prev) => ({
      ...prev,
      cnpj: prev.cnpj === cnpj ? undefined : cnpj,
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
            {(errorCount > 0 || reprocessing) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReprocessErrors}
                disabled={reprocessing || sendingDrafts}
                className="text-orange-600 border-orange-300 hover:bg-orange-50 hover:text-orange-700"
              >
                <RotateCcw className={`h-4 w-4 mr-2 ${reprocessing ? 'animate-spin' : ''}`} />
                {reprocessing ? 'Reprocessando...' : `Reprocessar ${errorCount} erro(s)`}
              </Button>
            )}
            {(draftCount > 0 || sendingDrafts) && (
              <Button
                variant="default"
                size="sm"
                onClick={handleSendDrafts}
                disabled={sendingDrafts || reprocessing}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Send className={`h-4 w-4 mr-2 ${sendingDrafts ? 'animate-pulse' : ''}`} />
                {sendingDrafts ? 'Enviando...' : `Enviar ${draftCount} rascunho(s)`}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncD4Sign}
              disabled={syncing}
            >
              <CloudDownload className={`h-4 w-4 mr-2 ${syncing ? 'animate-pulse' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar D4Sign'}
            </Button>
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
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBatchOpen(true)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Gerar em lote
                </Button>
                <Button size="sm" onClick={() => setGenerateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Gerar documento
                </Button>
              </>
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
        <VIStatusDashboard documents={documents} total={total} companyId={selectedCompanyId} serverStats={data?.stats} />

        {/* Cards por CNPJ (empresa contábil) */}
        {filters.competencia && cnpjGroups.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Empresas (CNPJ)</p>
            <div className="flex flex-wrap gap-3">
              {cnpjGroups.map((g) => {
                const docsInGroup = documents.filter(
                  (d) => d.employee_accounting_cnpj === g.cnpj,
                );
                const signedInGroup = docsInGroup.filter(
                  (d) => d.d4sign_status === 'signed',
                ).length;
                const pct = docsInGroup.length > 0
                  ? Math.round((signedInGroup / docsInGroup.length) * 100)
                  : 0;
                const isSelected = filters.cnpj === g.cnpj;

                return (
                  <Card
                    key={g.cnpj}
                    role="button"
                    tabIndex={0}
                    className={`p-3 cursor-pointer flex items-center gap-3 transition-all select-none
                      ${isSelected
                        ? 'border-primary ring-1 ring-primary'
                        : 'hover:border-primary/50'
                      }`}
                    onClick={() => handleCnpjCardClick(g.cnpj)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCnpjCardClick(g.cnpj);
                      }
                    }}
                  >
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{g.companyName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{g.cnpj}</p>
                    </div>
                    {docsInGroup.length > 0 && (
                      <Badge
                        variant={pct === 100 ? 'default' : 'secondary'}
                        className="ml-auto text-xs shrink-0"
                      >
                        {pct}% ass.
                      </Badge>
                    )}
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

        {/* Dialog de geração individual */}
        {selectedCompanyId && (
          <VIGenerateDialog
            companyId={selectedCompanyId}
            open={generateOpen}
            onClose={() => setGenerateOpen(false)}
          />
        )}

        {/* Dialog de geração em lote */}
        {selectedCompanyId && (
          <VIBatchGenerateDialog
            companyId={selectedCompanyId}
            open={batchOpen}
            onClose={() => { setBatchOpen(false); refetch(); }}
          />
        )}
      </div>
    </MainLayout>
  );
}
