import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";

export interface Employee {
  id: string;
  full_name: string;
  cpf: string | null;
}

export function useEmployees(enabled: boolean) {
  return useQuery<Employee[]>({
    queryKey: ["external-employees-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_employees")
        .select("id, full_name, cpf")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Employee[];
    },
    enabled,
  });
}

export function useEmployeeSearch(employees: Employee[]) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return employees;
    const term = search.toLowerCase();
    return employees.filter((e) => {
      return (
        e.full_name.toLowerCase().includes(term) ||
        (e.cpf || "").includes(term)
      );
    });
  }, [employees, search]);

  return { search, setSearch, filtered };
}
