import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/external-client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import type {
  PJContract,
  PJContractFormData,
  PJVacationEvent,
  PJVacationFormData,
  PJVacationBalance,
  PJClosing,
  PJClosingFormData,
  PJOtherItem,
  PJEmailLog,
} from "@/lib/pj-types";

// ============================================================
// Hook: useControlePJ — lista + KPIs da tela principal
// ============================================================

export function useControlePJ(competence?: string) {
  const { selectedCompanyId } = useCompany();

  const contractsQuery = useQuery({
    queryKey: ["pj-contracts", selectedCompanyId],
    queryFn: async () => {
      let query = supabase
        .from("pj_contracts")
        .select(`
          *,
          company:companies!pj_contracts_company_id_fkey(id, name),
          manager:profiles!pj_contracts_manager_user_id_fkey(id, first_name, last_name, avatar_url),
          cost_center:areas!pj_contracts_cost_center_id_fkey(id, name)
        `)
        .order("name");

      if (selectedCompanyId) {
        query = query.eq("company_id", selectedCompanyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as PJContract[];
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const closingsQuery = useQuery({
    queryKey: ["pj-closings", competence],
    queryFn: async () => {
      if (!competence) return [];
      let query = supabase
        .from("pj_closings")
        .select(`
          *,
          contract:pj_contracts!pj_closings_contract_id_fkey(
            id, name, company_id, email,
            company:companies!pj_contracts_company_id_fkey(id, name)
          )
        `)
        .eq("competence", competence);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as PJClosing[];
    },
    enabled: !!competence,
    staleTime: 1000 * 60 * 2,
  });

  // KPIs — memoized to avoid recomputation on every render
  const contracts = contractsQuery.data || [];
  const closings = closingsQuery.data || [];

  const activeContracts = useMemo(
    () => contracts.filter(c => c.status === "active"),
    [contracts]
  );

  const kpis = useMemo(() => {
    const closedOrPaid = closings.filter(c => c.status === "closed" || c.status === "paid");
    const pendingClosing = activeContracts.length - closedOrPaid.length;
    const pendingEmail = closings.filter(c => c.email_status !== "sent" && c.status !== "draft");
    const totalLiquid = closings.reduce((acc, c) => acc + Number(c.total_value || 0), 0);
    return {
      totalActive: activeContracts.length,
      totalLiquid,
      pendingClosing: Math.max(pendingClosing, 0),
      pendingEmail: pendingEmail.length,
    };
  }, [closings, activeContracts]);

  return {
    contracts,
    activeContracts,
    closings,
    isLoading: contractsQuery.isLoading || closingsQuery.isLoading,
    isError: contractsQuery.isError || closingsQuery.isError,
    error: contractsQuery.error || closingsQuery.error,
    kpis,
    refetch: () => {
      contractsQuery.refetch();
      closingsQuery.refetch();
    },
  };
}

// ============================================================
// Hook: usePJContract — CRUD de contrato individual
// ============================================================

export function usePJContract(contractId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const contractQuery = useQuery({
    queryKey: ["pj-contract", contractId],
    queryFn: async () => {
      if (!contractId) return null;
      const { data, error } = await supabase
        .from("pj_contracts")
        .select(`
          *,
          company:companies!pj_contracts_company_id_fkey(id, name),
          manager:profiles!pj_contracts_manager_user_id_fkey(id, first_name, last_name, avatar_url),
          cost_center:areas!pj_contracts_cost_center_id_fkey(id, name)
        `)
        .eq("id", contractId)
        .single();
      if (error) throw error;
      return data as unknown as PJContract;
    },
    enabled: !!contractId,
  });

  const createContract = useMutation({
    mutationFn: async (data: PJContractFormData) => {
      const { data: result, error } = await supabase
        .from("pj_contracts")
        .insert({ ...data, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pj-contracts"] });
      toast.success("Contrato PJ criado com sucesso");
    },
    onError: (err: Error) => {
      toast.error("Erro ao criar contrato: " + err.message);
    },
  });

  const updateContract = useMutation({
    mutationFn: async (data: Partial<PJContractFormData> & { id: string }) => {
      const { id, ...rest } = data;
      const { data: result, error } = await supabase
        .from("pj_contracts")
        .update(rest)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pj-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["pj-contract", contractId] });
      toast.success("Contrato atualizado com sucesso");
    },
    onError: (err: Error) => {
      toast.error("Erro ao atualizar contrato: " + err.message);
    },
  });

  const deleteContract = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pj_contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pj-contracts"] });
      toast.success("Contrato excluído com sucesso");
    },
    onError: (err: Error) => {
      toast.error("Erro ao excluir contrato: " + err.message);
    },
  });

  return {
    contract: contractQuery.data,
    isLoading: contractQuery.isLoading,
    createContract,
    updateContract,
    deleteContract,
  };
}

// ============================================================
// Hook: usePJVacation — folgas + saldo
// ============================================================

export function usePJVacation(contractId?: string, year?: number) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const currentYear = year || new Date().getFullYear();

  const eventsQuery = useQuery({
    queryKey: ["pj-vacation-events", contractId, currentYear],
    queryFn: async () => {
      if (!contractId) return [];
      const { data, error } = await supabase
        .from("pj_vacation_events")
        .select("*")
        .eq("contract_id", contractId)
        .gte("start_date", `${currentYear}-01-01`)
        .lte("start_date", `${currentYear}-12-31`)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PJVacationEvent[];
    },
    enabled: !!contractId,
  });

  const balanceQuery = useQuery({
    queryKey: ["pj-vacation-balance", contractId, currentYear],
    queryFn: async () => {
      if (!contractId) return null;
      const { data, error } = await supabase
        .from("pj_vacation_balance")
        .select("*")
        .eq("contract_id", contractId)
        .eq("year", currentYear)
        .maybeSingle();
      if (error) throw error;
      // Se não tem registro, retorna default
      return (data as unknown as PJVacationBalance) || {
        contract_id: contractId,
        year: currentYear,
        entitlement_days: 30,
        used_days: 0,
        remaining_days: 30,
        updated_at: new Date().toISOString(),
      };
    },
    enabled: !!contractId,
  });

  const createEvent = useMutation({
    mutationFn: async (data: PJVacationFormData) => {
      const { data: result, error } = await supabase
        .from("pj_vacation_events")
        .insert({ ...data, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pj-vacation-events", contractId] });
      queryClient.invalidateQueries({ queryKey: ["pj-vacation-balance", contractId] });
      toast.success("Folga registrada com sucesso");
    },
    onError: (err: Error) => {
      toast.error("Erro ao registrar folga: " + err.message);
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pj_vacation_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pj-vacation-events", contractId] });
      queryClient.invalidateQueries({ queryKey: ["pj-vacation-balance", contractId] });
      toast.success("Folga removida com sucesso");
    },
    onError: (err: Error) => {
      toast.error("Erro ao remover folga: " + err.message);
    },
  });

  return {
    events: eventsQuery.data || [],
    balance: balanceQuery.data,
    isLoading: eventsQuery.isLoading || balanceQuery.isLoading,
    createEvent,
    deleteEvent,
  };
}

// ============================================================
// Hook: usePJClosings — fechamentos de um contrato
// ============================================================

export function usePJClosings(contractId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const closingsQuery = useQuery({
    queryKey: ["pj-contract-closings", contractId],
    queryFn: async () => {
      if (!contractId) return [];
      const { data, error } = await supabase
        .from("pj_closings")
        .select("*")
        .eq("contract_id", contractId)
        .order("competence", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PJClosing[];
    },
    enabled: !!contractId,
  });

  // Helper: invalidate all closing-related queries
  const invalidateClosingQueries = () => {
    // When contractId is set, invalidate specific + broad; otherwise just broad
    if (contractId) {
      queryClient.invalidateQueries({ queryKey: ["pj-contract-closings", contractId] });
    } else {
      queryClient.invalidateQueries({ queryKey: ["pj-contract-closings"] });
    }
    queryClient.invalidateQueries({ queryKey: ["pj-closings"] });
  };

  const createClosing = useMutation({
    mutationFn: async (data: PJClosingFormData) => {
      // Calcular dependentes
      const contractRes = await supabase
        .from("pj_contracts")
        .select("health_dependents_count, health_dependent_unit_value")
        .eq("id", data.contract_id)
        .single();
      if (contractRes.error) throw contractRes.error;
      const c = contractRes.data;

      const healthDependentsDiscount = (c.health_dependents_count || 0) * (c.health_dependent_unit_value || 0);

      const otherEarnings = (data.other_items || [])
        .filter((i: PJOtherItem) => i.type === "earning")
        .reduce((s: number, i: PJOtherItem) => s + i.value, 0);
      const otherDiscounts = (data.other_items || [])
        .filter((i: PJOtherItem) => i.type === "discount")
        .reduce((s: number, i: PJOtherItem) => s + i.value, 0);

      const earnings = data.base_value + otherEarnings + data.thirteenth_paid_value + data.fourteenth_paid_value;
      const discounts = data.restaurant_discount_value + healthDependentsDiscount + data.health_coparticipation_discount_value + otherDiscounts;
      const totalValue = earnings - discounts;

      const { data: result, error } = await supabase
        .from("pj_closings")
        .insert({
          ...data,
          health_dependents_discount_value: healthDependentsDiscount,
          total_value: totalValue,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      invalidateClosingQueries();
      toast.success("Fechamento criado com sucesso");
    },
    onError: (err: Error) => {
      toast.error("Erro ao criar fechamento: " + err.message);
    },
  });

  const updateClosing = useMutation({
    mutationFn: async (data: Partial<PJClosingFormData> & { id: string; contract_id: string }) => {
      const { id, ...rest } = data;

      // Recalcular total se campos de valor estiverem presentes
      let updateData: Record<string, unknown> = { ...rest };

      if (rest.base_value !== undefined) {
        const contractRes = await supabase
          .from("pj_contracts")
          .select("health_dependents_count, health_dependent_unit_value")
          .eq("id", rest.contract_id)
          .single();
        if (contractRes.error) throw contractRes.error;
        const c = contractRes.data;
        const healthDependentsDiscount = (c.health_dependents_count || 0) * (c.health_dependent_unit_value || 0);

        const otherEarnings = ((rest.other_items || []) as PJOtherItem[])
          .filter(i => i.type === "earning")
          .reduce((s, i) => s + i.value, 0);
        const otherDiscounts = ((rest.other_items || []) as PJOtherItem[])
          .filter(i => i.type === "discount")
          .reduce((s, i) => s + i.value, 0);

        const earnings = (rest.base_value || 0) + otherEarnings + (rest.thirteenth_paid_value || 0) + (rest.fourteenth_paid_value || 0);
        const discounts = (rest.restaurant_discount_value || 0) + healthDependentsDiscount + (rest.health_coparticipation_discount_value || 0) + otherDiscounts;
        updateData.health_dependents_discount_value = healthDependentsDiscount;
        updateData.total_value = earnings - discounts;
      }

      const { data: result, error } = await supabase
        .from("pj_closings")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      invalidateClosingQueries();
      toast.success("Fechamento atualizado com sucesso");
    },
    onError: (err: Error) => {
      toast.error("Erro ao atualizar fechamento: " + err.message);
    },
  });

  const deleteClosing = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pj_closings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateClosingQueries();
      toast.success("Fechamento excluído com sucesso");
    },
    onError: (err: Error) => {
      toast.error("Erro ao excluir fechamento: " + err.message);
    },
  });

  // Marcar como pago
  const markAsPaid = useMutation({
    mutationFn: async ({ id, receipt_url }: { id: string; receipt_url?: string }) => {
      const { data: result, error } = await supabase
        .from("pj_closings")
        .update({ status: "paid", paid_at: new Date().toISOString(), receipt_url })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      invalidateClosingQueries();
      toast.success("Fechamento marcado como pago");
    },
    onError: (err: Error) => {
      toast.error("Erro ao marcar como pago: " + err.message);
    },
  });

  // Fechar competência (gerar holerite + enviar e-mail via Edge Function)
  const closeCompetence = useMutation({
    mutationFn: async (closingId: string) => {
      // 1. Gerar holerite
      const { data: pdfResult, error: pdfError } = await supabase.functions.invoke(
        "generate-pj-payslip",
        { body: { closingId } }
      );
      if (pdfError) throw new Error("Erro ao gerar holerite: " + pdfError.message);

      // 2. Atualizar status para closed
      const { error: updateError } = await supabase
        .from("pj_closings")
        .update({ status: "closed" })
        .eq("id", closingId);
      if (updateError) throw updateError;

      // 3. Enviar e-mail
      const { error: emailError } = await supabase.functions.invoke(
        "send-pj-payslip-email",
        { body: { closingId } }
      );
      if (emailError) {
        console.error("Erro ao enviar e-mail (holerite gerado):", emailError);
        toast.warning("Holerite gerado, mas houve erro no envio do e-mail. Tente reenviar.");
      }

      return pdfResult;
    },
    onSuccess: () => {
      invalidateClosingQueries();
      toast.success("Competência fechada — holerite gerado e enviado");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Reenviar holerite
  const resendPayslip = useMutation({
    mutationFn: async (closingId: string) => {
      const { error } = await supabase.functions.invoke(
        "send-pj-payslip-email",
        { body: { closingId } }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateClosingQueries();
      toast.success("Holerite reenviado com sucesso");
    },
    onError: (err: Error) => {
      toast.error("Erro ao reenviar holerite: " + err.message);
    },
  });

  return {
    closings: closingsQuery.data || [],
    isLoading: closingsQuery.isLoading,
    createClosing,
    updateClosing,
    deleteClosing,
    markAsPaid,
    closeCompetence,
    resendPayslip,
  };
}

// ============================================================
// Hook: usePJEmailLogs
// ============================================================

export function usePJEmailLogs(closingId?: string) {
  const logsQuery = useQuery({
    queryKey: ["pj-email-logs", closingId],
    queryFn: async () => {
      if (!closingId) return [];
      const { data, error } = await supabase
        .from("pj_email_logs")
        .select("*")
        .eq("closing_id", closingId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PJEmailLog[];
    },
    enabled: !!closingId,
  });

  return {
    logs: logsQuery.data || [],
    isLoading: logsQuery.isLoading,
  };
}
