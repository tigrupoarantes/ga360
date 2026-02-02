import { ReactNode, useEffect } from "react";
import { AppleNav } from "./AppleNav";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/external-client";
import { Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { selectedCompanyId, setSelectedCompanyId, companies, setCompanies } = useCompany();

  useEffect(() => {
    const fetchCompanies = async () => {
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("is_active", true)
        .order("name");
      
      if (data) {
        setCompanies(data);
      }
    };
    
    fetchCompanies();
  }, [setCompanies]);

  return (
    <div className="min-h-screen bg-background">
      <AppleNav />
      
      {/* Barra do Seletor de Empresas */}
      <div className="fixed top-14 left-0 right-0 z-40 glass border-b border-border/50">
        <div className="container-apple py-2">
          <Select 
            value={selectedCompanyId || "all"} 
            onValueChange={(value) => setSelectedCompanyId(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-full max-w-xs bg-secondary/50 border-none">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Todas as Empresas" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Empresas</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Conteúdo principal - ajustar padding-top para acomodar as duas barras */}
      <main className="pt-28">
        <div className="container-apple py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
