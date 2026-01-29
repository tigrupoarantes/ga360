import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle2, Clock, ArrowRight } from "lucide-react";
import { useUnitAuditStatus } from "@/hooks/useStockAudit";
import { Skeleton } from "@/components/ui/skeleton";

interface UnitSelectorProps {
  onSelect: (unitId: string, unitName: string) => void;
}

export function UnitSelector({ onSelect }: UnitSelectorProps) {
  // Fetch companies marked as auditable
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies-for-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, logo_url, color")
        .eq("is_active", true)
        .eq("is_auditable", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: auditStatus = {} } = useUnitAuditStatus();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Escolha a Unidade</h2>
        <p className="text-muted-foreground mt-1">
          Selecione a unidade para iniciar a auditoria de estoque
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {companies.map((company) => {
          const status = auditStatus[company.id];
          const isCompleted = status === "completed";
          const isInProgress = status === "in_progress" || status === "draft";

          return (
            <Card
              key={company.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] group ${
                isCompleted ? "border-green-500/50 bg-green-50/30 dark:bg-green-950/20" : ""
              }`}
              onClick={() => onSelect(company.id, company.name)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div 
                      className="h-14 w-14 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm"
                      style={{ backgroundColor: company.color || "#6366f1" }}
                    >
                      {company.logo_url ? (
                        <img 
                          src={company.logo_url} 
                          alt={company.name}
                          className="h-10 w-10 object-contain"
                        />
                      ) : (
                        <Building2 className="h-7 w-7" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
                        {company.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        {isCompleted ? (
                          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Concluída
                          </Badge>
                        ) : isInProgress ? (
                          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">
                            <Clock className="h-3 w-3 mr-1" />
                            Em andamento
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            <Clock className="h-3 w-3 mr-1" />
                            Pendente este mês
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {companies.length === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">Nenhuma empresa habilitada para auditoria</p>
          <p className="text-sm mt-2">
            Configure as empresas auditáveis em Admin → Estrutura Organizacional
          </p>
        </div>
      )}
    </div>
  );
}
