import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface StockAudit {
  id: string;
  company_id: string;
  unit_id: string;
  auditor_user_id: string;
  card_id: string | null;
  planned_date: string | null;
  executed_date: string | null;
  cutoff_datetime: string | null;
  status: "draft" | "in_progress" | "completed" | "reviewed";
  blind_count_enabled: boolean;
  sample_size: number | null;
  sampling_method: string;
  base_file_url: string | null;
  base_file_type: string | null;
  base_file_meta: unknown;
  total_items_loaded: number;
  movement_during_audit: boolean;
  movement_notes: string | null;
  witness_name: string | null;
  witness_cpf: string | null;
  witness_term_accepted: boolean;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
  unit?: { id: string; name: string };
}

export interface StockAuditItem {
  id: string;
  stock_audit_id: string;
  sku_code: string;
  sku_description: string | null;
  uom: string | null;
  location: string | null;
  system_qty: number;
  physical_qty: number | null;
  recount_qty: number | null;
  final_physical_qty: number | null;
  final_diff_qty: number | null;
  result: "pending" | "ok" | "divergent" | "recount_required" | "divergent_confirmed";
  is_in_sample: boolean;
  root_cause_code: string | null;
  root_cause_notes: string | null;
  item_notes: string | null;
  audited_at: string | null;
  created_at: string;
}

export function useStockAudit(auditId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch single audit
  const { data: audit, isLoading: auditLoading } = useQuery({
    queryKey: ["stock-audit", auditId],
    queryFn: async () => {
      if (!auditId) return null;
      const { data, error } = await supabase
        .from("stock_audits")
        .select("*, unit:companies!stock_audits_unit_id_fkey(id, name)")
        .eq("id", auditId)
        .single();
      if (error) throw error;
      return data as StockAudit;
    },
    enabled: !!auditId,
  });

  // Fetch audit items
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["stock-audit-items", auditId],
    queryFn: async () => {
      if (!auditId) return [];
      const { data, error } = await supabase
        .from("stock_audit_items")
        .select("*")
        .eq("stock_audit_id", auditId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as StockAuditItem[];
    },
    enabled: !!auditId,
  });

  // Fetch sample items only
  const sampleItems = items.filter(item => item.is_in_sample);

  // Create new audit
  const createAudit = useMutation({
    mutationFn: async (unitId: string) => {
      if (!user) throw new Error("User not authenticated");
      
      const { data, error } = await supabase
        .from("stock_audits")
        .insert({
          unit_id: unitId,
          company_id: unitId, // Using same as unit for now
          auditor_user_id: user.id,
          status: "draft",
          blind_count_enabled: true,
          sampling_method: "random",
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-audits"] });
    },
    onError: (error) => {
      toast.error("Erro ao criar auditoria", { description: error.message });
    },
  });

  // Update audit
  const updateAudit = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!auditId) throw new Error("No audit ID");
      
      const { data, error } = await supabase
        .from("stock_audits")
        .update(updates)
        .eq("id", auditId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-audit", auditId] });
    },
    onError: (error) => {
      toast.error("Erro ao atualizar auditoria", { description: error.message });
    },
  });

  // Insert items from CSV
  const insertItems = useMutation({
    mutationFn: async (itemsData: Omit<StockAuditItem, "id" | "created_at">[]) => {
      if (!auditId) throw new Error("No audit ID");
      
      const { data, error } = await supabase
        .from("stock_audit_items")
        .insert(itemsData.map(item => ({ ...item, stock_audit_id: auditId })))
        .select();
      
      if (error) throw error;
      
      // Update total items count
      await supabase
        .from("stock_audits")
        .update({ total_items_loaded: itemsData.length })
        .eq("id", auditId);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-audit-items", auditId] });
      queryClient.invalidateQueries({ queryKey: ["stock-audit", auditId] });
    },
    onError: (error) => {
      toast.error("Erro ao inserir itens", { description: error.message });
    },
  });

  // Update single item
  const updateItem = useMutation({
    mutationFn: async ({ itemId, updates }: { itemId: string; updates: Partial<StockAuditItem> }) => {
      const { data, error } = await supabase
        .from("stock_audit_items")
        .update(updates)
        .eq("id", itemId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-audit-items", auditId] });
    },
    onError: (error) => {
      toast.error("Erro ao atualizar item", { description: error.message });
    },
  });

  // Generate sample
  const generateSample = useCallback(async (sampleSize: number) => {
    if (!auditId || items.length === 0) return;

    // Reset all items to not in sample
    await supabase
      .from("stock_audit_items")
      .update({ is_in_sample: false })
      .eq("stock_audit_id", auditId);

    // Randomly select items
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    const selectedIds = shuffled.slice(0, Math.min(sampleSize, items.length)).map(i => i.id);

    // Mark selected items
    if (selectedIds.length > 0) {
      await supabase
        .from("stock_audit_items")
        .update({ is_in_sample: true })
        .in("id", selectedIds);
    }

    // Update audit sample size
    await supabase
      .from("stock_audits")
      .update({ sample_size: sampleSize, status: "in_progress" })
      .eq("id", auditId);

    queryClient.invalidateQueries({ queryKey: ["stock-audit-items", auditId] });
    queryClient.invalidateQueries({ queryKey: ["stock-audit", auditId] });
    
    toast.success(`Amostra gerada: ${selectedIds.length} itens selecionados`);
  }, [auditId, items, queryClient]);

  // Complete audit
  const completeAudit = useMutation({
    mutationFn: async (witnessData: { name: string; cpf: string; movementDuringAudit: boolean; movementNotes?: string }) => {
      if (!auditId) throw new Error("No audit ID");
      
      const { data, error } = await supabase
        .from("stock_audits")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          executed_date: new Date().toISOString().split("T")[0],
          witness_name: witnessData.name,
          witness_cpf: witnessData.cpf,
          witness_term_accepted: true,
          movement_during_audit: witnessData.movementDuringAudit,
          movement_notes: witnessData.movementNotes || null,
        })
        .eq("id", auditId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-audit", auditId] });
      queryClient.invalidateQueries({ queryKey: ["stock-audits"] });
      toast.success("Auditoria concluída com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao concluir auditoria", { description: error.message });
    },
  });

  // Get audit stats
  const stats = {
    total: sampleItems.length,
    counted: sampleItems.filter(i => i.result !== "pending").length,
    ok: sampleItems.filter(i => i.result === "ok").length,
    divergent: sampleItems.filter(i => i.result === "divergent" || i.result === "divergent_confirmed").length,
    pending: sampleItems.filter(i => i.result === "pending").length,
    recounted: sampleItems.filter(i => i.recount_qty !== null).length,
  };

  return {
    audit,
    items,
    sampleItems,
    stats,
    isLoading: auditLoading || itemsLoading,
    createAudit,
    updateAudit,
    insertItems,
    updateItem,
    generateSample,
    completeAudit,
  };
}

// Hook to fetch all audits with history
export function useStockAudits() {
  return useQuery({
    queryKey: ["stock-audits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_audits")
        .select("*, unit:companies!stock_audits_unit_id_fkey(id, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as StockAudit[];
    },
  });
}

// Hook to get audit status by unit for current month
export function useUnitAuditStatus() {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  
  return useQuery({
    queryKey: ["unit-audit-status", currentMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_audits")
        .select("unit_id, status")
        .gte("created_at", `${currentMonth}-01`)
        .lt("created_at", `${currentMonth}-32`);
      
      if (error) throw error;
      
      // Create map of unit_id -> latest status
      const statusMap: Record<string, string> = {};
      data?.forEach(audit => {
        if (!statusMap[audit.unit_id] || audit.status === "completed") {
          statusMap[audit.unit_id] = audit.status;
        }
      });
      
      return statusMap;
    },
  });
}
