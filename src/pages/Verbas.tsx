import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { BackButton } from "@/components/ui/back-button";
import { useCardPermissions } from "@/hooks/useCardPermissions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert, Search, EyeOff, Eye, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompany } from "@/contexts/CompanyContext";

type VerbasAccess = "full" | "masked";

interface VerbasRow {
  company_id: string;
  razao_social: string;
  cpf: string;
  nome_funcionario: string;
  tipo_verba: string;
  ano: number;
  janeiro: number | null;
  fevereiro: number | null;
  marco: number | null;
  abril: number | null;
  maio: number | null;
  junho: number | null;
  julho: number | null;
  agosto: number | null;
  setembro: number | null;
  outubro: number | null;
  novembro: number | null;
  dezembro: number | null;
  masked?: boolean;
}

interface VerbasResponse {
  success: boolean;
  access: VerbasAccess;
  page: number;
  pageSize: number;
  total: number;
  sync_warning?: string;
  sync_error?: string;
  sync_result?: {
    received?: number;
    processed?: number;
    failed?: number;
    upserted?: number;
    duration_ms?: number;
    source_system?: string;
    failure_reasons?: Array<{ reason?: string; count?: number }>;
  };
  rows: VerbasRow[];
}

const MONTH_COLUMNS = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

const TIPO_VERBA_OPTIONS = [
  "SALDO_SALARIO",
  "COMPLEMENTO_SALARIAL",
  "COMISSAO_DSR",
  "BONUS",
  "PREMIO",
  "ADCNOT_HORAEXTRA_DSR",
  "VERBA_INDENIZATORIA",
  "VALE_ALIMENTACAO",
  "DESC_PLANO_SAUDE",
  "PLANO_SAUDE_EMPRESA",
  "SEGURO_VIDA",
  "SST",
  "FGTS",
  "OUTROS",
];

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function VerbasPage() {
  const navigate = useNavigate();
  const { hasCardPermission, isLoading: permissionsLoading } = useCardPermissions();
  const { selectedCompanyId } = useCompany();
  const [ano, setAno] = useState<string>(String(new Date().getFullYear()));
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [tipoVerba, setTipoVerba] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState("25");
  const [syncing, setSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState<VerbasResponse["sync_result"] | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const { data: verbasCard, isLoading: cardLoading } = useQuery({
    queryKey: ["ec-verbas-card"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ec_cards")
        .select("id, title")
        .ilike("title", "%verbas%")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["verbas-secure-query", selectedCompanyId, ano, cpf, nome, tipoVerba, page, pageSize],
    queryFn: async () => {
      const body = {
        ...(selectedCompanyId ? { companyId: selectedCompanyId } : {}),
        ...(ano ? { ano: Number(ano) } : {}),
        ...(cpf.trim() ? { cpf: cpf.trim() } : {}),
        ...(nome.trim() ? { nome: nome.trim() } : {}),
        ...(tipoVerba !== "all" ? { tipoVerba } : {}),
        autoSyncWhenEmpty: false,
        page,
        pageSize: Number(pageSize),
      };

      const { data: response, error: invokeError } = await supabase.functions.invoke("verbas-secure-query", {
        body,
      });

      if (invokeError) {
        let details = invokeError.message;
        try {
          if (invokeError.context) {
            const json = await invokeError.context.json();
            details = json?.error || json?.message || details;
          }
        } catch {
          // noop
        }
        throw new Error(details || "Falha ao consultar verbas");
      }

      return (response || { rows: [], total: 0, page, pageSize: Number(pageSize), access: "masked" }) as VerbasResponse;
    },
    enabled: !permissionsLoading && !cardLoading && !!verbasCard && hasCardPermission(verbasCard.id, "view"),
  });

  const handleSyncVerbas = async () => {
    setSyncing(true);
    setSyncError(null);
    setSyncSummary(null);

    try {
      const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      const targetYear = Number(ano);

      const aggregate = {
        received: 0,
        processed: 0,
        failed: 0,
        upserted: 0,
        duration_ms: 0,
        failure_reasons: new Map<string, number>(),
      };

      for (const month of months) {
        setSyncError(`Sincronizando ${month}/12...`);

        const body = {
          ...(selectedCompanyId ? { companyId: selectedCompanyId } : {}),
          ...(Number.isFinite(targetYear) ? { ano: targetYear } : {}),
          autoSyncWhenEmpty: false,
          syncNow: true,
          syncMonth: month,
          syncMaxPages: 25,
          page: 1,
          pageSize: Number(pageSize),
        };

        const { data: response, error: invokeError } = await supabase.functions.invoke("verbas-secure-query", {
          body,
        });

        if (invokeError) {
          let details = invokeError.message;
          try {
            if (invokeError.context) {
              const json = await invokeError.context.json();
              details = json?.error || json?.message || details;
            }
          } catch {
            // noop
          }
          throw new Error(`Mês ${month}: ${details || "Falha ao sincronizar verbas"}`);
        }

        const typedResponse = (response || {}) as VerbasResponse;
        const result = typedResponse.sync_result;

        aggregate.received += result?.received ?? 0;
        aggregate.processed += result?.processed ?? 0;
        aggregate.failed += result?.failed ?? 0;
        aggregate.upserted += result?.upserted ?? 0;
        aggregate.duration_ms += result?.duration_ms ?? 0;

        for (const reason of result?.failure_reasons || []) {
          const key = reason.reason || "erro";
          aggregate.failure_reasons.set(key, (aggregate.failure_reasons.get(key) || 0) + (reason.count ?? 0));
        }

        if (typedResponse.sync_error) {
          throw new Error(`Mês ${month}: ${typedResponse.sync_error}`);
        }
      }

      setSyncSummary({
        received: aggregate.received,
        processed: aggregate.processed,
        failed: aggregate.failed,
        upserted: aggregate.upserted,
        duration_ms: aggregate.duration_ms,
        failure_reasons: [...aggregate.failure_reasons.entries()]
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
          .slice(0, 10),
      });
      setSyncError(null);
      setPage(1);
      await refetch();
    } catch (err) {
      setSyncError((err as Error).message || "Erro ao sincronizar verbas");
    } finally {
      setSyncing(false);
    }
  };

  const totalPages = useMemo(() => {
    const total = data?.total || 0;
    const size = Number(pageSize) || 25;
    return Math.max(1, Math.ceil(total / size));
  }, [data?.total, pageSize]);

  if (permissionsLoading || cardLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (verbasCard && !hasCardPermission(verbasCard.id, "view")) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <ShieldAlert className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground text-lg">Você não tem permissão para acessar VERBAS</p>
          <Button variant="outline" onClick={() => navigate("/governanca-ec/pessoas-cultura")}>
            Voltar para Pessoas & Cultura
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <BackButton to="/governanca-ec/pessoas-cultura" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">VERBAS</h1>
            <p className="text-muted-foreground mt-1">Consulta sensível de remuneração por colaborador e tipo de verba</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Ano</p>
                <Input value={ano} onChange={(e) => setAno(e.target.value)} className="w-28" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">CPF</p>
                <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="Digite CPF" className="w-44" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Funcionário</p>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" className="w-56" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Tipo de verba</p>
                <Select value={tipoVerba} onValueChange={setTipoVerba}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {TIPO_VERBA_OPTIONS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => {
                  setPage(1);
                  refetch();
                }}
                disabled={isFetching}
              >
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>

              <Button variant="outline" onClick={handleSyncVerbas} disabled={syncing}>
                {syncing ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sincronizar verbas
              </Button>

              <Button variant="outline" onClick={() => navigate("/admin/datalake?tab=logs")}>
                Ver logs da sincronização
              </Button>

              {data?.access && (
                <Badge variant={data.access === "full" ? "default" : "secondary"} className="ml-auto">
                  {data.access === "full" ? (
                    <><Eye className="h-3 w-3 mr-1" /> Acesso completo</>
                  ) : (
                    <><EyeOff className="h-3 w-3 mr-1" /> Acesso mascarado</>
                  )}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 text-sm text-muted-foreground">Carregando verbas...</div>
            ) : error ? (
              <div className="p-6 text-sm text-destructive">{(error as Error).message}</div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Tipo Verba</TableHead>
                      <TableHead>Ano</TableHead>
                      {MONTH_COLUMNS.map((month) => (
                        <TableHead key={month}>{month.slice(0, 3).toUpperCase()}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.rows || []).map((row, index) => (
                      <TableRow key={`${row.company_id}-${row.cpf}-${row.tipo_verba}-${row.ano}-${index}`}>
                        <TableCell>{row.razao_social}</TableCell>
                        <TableCell>{row.cpf}</TableCell>
                        <TableCell>{row.nome_funcionario}</TableCell>
                        <TableCell>{row.tipo_verba}</TableCell>
                        <TableCell>{row.ano}</TableCell>
                        {MONTH_COLUMNS.map((month) => (
                          <TableCell key={month}>{formatCurrency(row[month])}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {(data?.rows || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={17} className="text-center text-muted-foreground">
                          Nenhum registro encontrado com os filtros atuais.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                <div className="p-4 border-t flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total: {data?.total || 0} registros</p>
                    {syncSummary && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Sincronização: {syncSummary.upserted ?? 0} gravados/alterados, {syncSummary.processed ?? 0} processados, {syncSummary.failed ?? 0} falhas.
                        </p>
                        {!!syncSummary.failure_reasons?.length && (
                          <p className="text-xs text-muted-foreground">
                            Principais falhas: {syncSummary.failure_reasons.slice(0, 3).map((item) => `${item.reason || "erro"} (${item.count ?? 0})`).join(" • ")}
                          </p>
                        )}
                      </>
                    )}
                    {syncError && (
                      <p className="text-xs text-destructive">
                        Status da sincronização: {syncError}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={pageSize} onValueChange={(value) => { setPageSize(value); setPage(1); }}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>
                      Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">{page}/{totalPages}</span>
                    <Button variant="outline" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page >= totalPages}>
                      Próxima
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
