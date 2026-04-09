import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
export const VI_DELETABLE_STATUSES = ['draft', 'error', 'cancelled'] as const;

export interface VIDocument {
  id: string;
  company_id: string;
  template_id: string | null;
  employee_name: string;
  employee_cpf: string;
  employee_email: string | null;
  employee_department: string | null;
  employee_position: string | null;
  employee_unit: string | null;
  employee_accounting_group: string | null;
  employee_accounting_cnpj: string | null;
  event_type: string | null;
  competencia: string;
  ano: number;
  mes: number;
  valor_verba: number;
  valor_adiantamento: number;
  payload_json: Record<string, unknown> | null;
  d4sign_document_uuid: string | null;
  d4sign_safe_uuid: string | null;
  d4sign_status: string;
  d4sign_signer_key: string | null;
  d4sign_signer_email: string | null;
  d4sign_sent_at: string | null;
  d4sign_signed_at: string | null;
  d4sign_cancelled_at: string | null;
  d4sign_error_message: string | null;
  generated_file_path: string | null;
  signed_file_path: string | null;
  email_sent_at: string | null;
  email_reminder_count: number;
  last_reminder_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeWithVerba {
  cpf: string;
  nome: string;
  email: string | null;
  valor_verba: number;
  valor_adiantamento: number;
  department: string | null;
  position: string | null;
  unit: string | null;
  accounting_group: string | null;
  accounting_company_cnpj: string | null;
  accounting_company_name: string | null;
}

export interface VIQueryFilters {
  competencia?: string;
  cpf?: string;
  status?: string;
  accountingGroup?: string;
  cnpj?: string;
  page?: number;
  pageSize?: number;
}

export interface VIStats {
  signed: number;
  pending: number;
  awaiting: number;
  errors: number;
}

interface VIQueryResult {
  rows: VIDocument[];
  total: number;
  page: number;
  pageSize: number;
  stats?: VIStats;
}

async function callEdgeFunction<T>(
  token: string,
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Falha na chamada ${functionName}`);
  }
  return data as T;
}

export function useVerbasIndenizatorias(
  companyId: string | null,
  filters: VIQueryFilters = {},
) {
  return useQuery<VIQueryResult>({
    queryKey: ['verbas-indenizatorias', companyId, filters],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return { rows: [], total: 0, page: 1, pageSize: 50 };

      return callEdgeFunction<VIQueryResult>(token, 'verba-indenizatoria-query', {
        ...(companyId ? { companyId } : {}),
        ...(filters.competencia ? { competencia: filters.competencia } : {}),
        ...(filters.cpf ? { cpf: filters.cpf } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.cnpj ? { cnpj: filters.cnpj } : {}),
        ...(filters.accountingGroup ? { accountingGroups: [filters.accountingGroup] } : {}),
        page: filters.page,
        pageSize: filters.pageSize,
      });
    },
    enabled: true,
    staleTime: 30_000,
  });
}

export function useVIGenerate() {

  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      companyId: string;
      employeeCpf: string;
      competencia: string;
      templateId: string;
      sendToSign?: boolean;
      signerEmail?: string;
    }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Não autenticado');

      return callEdgeFunction(token, 'generate-verba-indenizatoria-doc', params);
    },
    onSuccess: (_, vars) => {
      toast.success('Documento gerado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['verbas-indenizatorias', vars.companyId] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao gerar documento: ${err.message}`);
    },
  });
}

export function useVIBatchGenerate() {

  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      companyId: string;
      competencia: string;
      templateId: string;
      employees: Array<{ cpf: string; email?: string }>;
      sendToSign?: boolean;
    }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Não autenticado');

      const results = [];
      for (const emp of params.employees) {
        try {
          const result = await callEdgeFunction(token, 'generate-verba-indenizatoria-doc', {
            companyId: params.companyId,
            employeeCpf: emp.cpf,
            competencia: params.competencia,
            templateId: params.templateId,
            sendToSign: params.sendToSign,
            signerEmail: emp.email,
          });
          results.push({ cpf: emp.cpf, ok: true, result });
        } catch (err) {
          results.push({ cpf: emp.cpf, ok: false, error: err instanceof Error ? err.message : 'Erro' });
        }
      }
      return results;
    },
    onSuccess: (results, vars) => {
      const ok = results.filter((r) => r.ok).length;
      const fail = results.filter((r) => !r.ok).length;
      toast.success(`Lote concluído: ${ok} gerado(s)${fail > 0 ? `, ${fail} com erro` : ''}`);
      queryClient.invalidateQueries({ queryKey: ['verbas-indenizatorias', vars.companyId] });
    },
    onError: (err: Error) => {
      toast.error(`Erro no lote: ${err.message}`);
    },
  });
}

export function useVISendToSign() {

  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { documentId: string; companyId: string; d4signDocumentUuid: string }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Não autenticado');

      return callEdgeFunction(token, 'd4sign-proxy', {
        action: 'send_to_sign',
        companyId: params.companyId,
        payload: { documentUuid: params.d4signDocumentUuid },
      });
    },
    onSuccess: (_, vars) => {
      toast.success('Documento enviado para assinatura');
      queryClient.invalidateQueries({ queryKey: ['verbas-indenizatorias', vars.companyId] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao enviar: ${err.message}`);
    },
  });
}

export function useVICancel() {

  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { companyId: string; d4signDocumentUuid: string; comment?: string }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Não autenticado');

      return callEdgeFunction(token, 'd4sign-proxy', {
        action: 'cancel_document',
        companyId: params.companyId,
        payload: { documentUuid: params.d4signDocumentUuid, comment: params.comment },
      });
    },
    onSuccess: (_, vars) => {
      toast.success('Documento cancelado');
      queryClient.invalidateQueries({ queryKey: ['verbas-indenizatorias', vars.companyId] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao cancelar: ${err.message}`);
    },
  });
}

export function useVIResend() {

  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { documentId: string; companyId: string }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Não autenticado');

      return callEdgeFunction(token, 'send-verba-indenizatoria-notification', {
        documentId: params.documentId,
        type: 'reminder',
      });
    },
    onSuccess: (_, vars) => {
      toast.success('Lembrete enviado');
      queryClient.invalidateQueries({ queryKey: ['verbas-indenizatorias', vars.companyId] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao reenviar: ${err.message}`);
    },
  });
}

export function useVIEmployeesWithVerba(
  companyId: string | null,
  competencia: string,
  accountingGroups?: string[],
  cnpjFilter?: string[],
) {
  return useQuery({
    queryKey: ['vi-employees-with-verba', companyId, competencia, accountingGroups, cnpjFilter],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token || !companyId || !competencia) return [];

      return callEdgeFunction<{ employees: EmployeeWithVerba[] }>(
        token,
        'verba-indenizatoria-query',
        {
          companyId,
          fetchEmployeesWithVerba: true,
          competencia,
          ...(cnpjFilter?.length ? { cnpjFilter } : {}),
          ...(accountingGroups?.length ? { accountingGroups } : {}),
        },
      ).then((r) => r.employees ?? []);
    },
    enabled: !!companyId && !!competencia,
    staleTime: 60_000,
  });
}

export function useVIAccountingGroups(companyId: string | null, competencia: string) {
  return useQuery<string[]>({
    queryKey: ['vi-accounting-groups', companyId, competencia],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token || !companyId || !competencia) return [];

      return callEdgeFunction<{ groups: string[] }>(
        token,
        'verba-indenizatoria-query',
        { companyId, fetchAccountingGroups: true, competencia },
      ).then((r) => r.groups ?? []);
    },
    enabled: !!companyId && !!competencia,
    staleTime: 5 * 60_000,
  });
}

export interface VICnpjGroup {
  cnpj: string;
  companyName: string;
}

export function useVICnpjGroups(companyId: string | null, competencia: string) {
  return useQuery<VICnpjGroup[]>({
    queryKey: ['vi-cnpj-groups', companyId, competencia],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token || !companyId || !competencia) return [];

      return callEdgeFunction<{ cnpjGroups: VICnpjGroup[] }>(
        token,
        'verba-indenizatoria-query',
        { companyId, fetchCnpjGroups: true, competencia },
      ).then((r) => r.cnpjGroups ?? []);
    },
    enabled: !!companyId && !!competencia,
    staleTime: 5 * 60_000,
  });
}

export function useCockpitVIConfig(companyId: string | null) {
  return useQuery<string[]>({
    queryKey: ['cockpit-vi-config', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('cockpit_vi_config')
        .select('vi_accounting_groups')
        .eq('company_id', companyId!)
        .maybeSingle();
      return (data?.vi_accounting_groups as string[]) ?? [];
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

export function useVIReprocess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      documentId: string;
      companyId: string;
      signerEmail?: string;
    }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Não autenticado');

      return callEdgeFunction<{ ok: true; newStatus: string; documentId: string; previousError: string }>(
        token,
        'reprocess-vi-error',
        params,
      );
    },
    onSuccess: (_, vars) => {
      toast.success('Documento preparado para reprocessamento');
      queryClient.invalidateQueries({ queryKey: ['verbas-indenizatorias', vars.companyId] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao reprocessar: ${err.message}`);
    },
  });
}

export function useVIDelete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      documentId: string;
      companyId: string;
    }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Não autenticado');

      return callEdgeFunction<{ success: true }>(token, 'delete-verba-indenizatoria-doc', {
        documentId: params.documentId,
        companyId: params.companyId,
      });
    },
    onSuccess: (_, vars) => {
      toast.success('Documento excluído');
      queryClient.invalidateQueries({ queryKey: ['verbas-indenizatorias', vars.companyId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useVIDocumentLogs(documentId: string | null, companyId: string | null) {


  return useQuery({
    queryKey: ['vi-logs', documentId, companyId],
    queryFn: async () => {
      if (!documentId || !companyId) return [];
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return [];

      return callEdgeFunction<{ logs: unknown[] }>(token, 'verba-indenizatoria-query', {
        companyId,
        documentId,
        fetchLogs: true,
      }).then((r) => r.logs ?? []);
    },
    enabled: !!documentId && !!companyId,
    staleTime: 10_000,
  });
}

export function useD4SignBalance(companyId: string | null) {
  return useQuery({
    queryKey: ['d4sign-balance', companyId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('d4sign-proxy', {
        body: { action: 'get_balance', companyId },
      });
      if (error) throw error;
      return data?.data as Record<string, unknown> | null;
    },
    enabled: !!companyId,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}
