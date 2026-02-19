import { MainLayout } from "@/components/layout/MainLayout";
import { BackButton } from "@/components/ui/back-button";
import { PJDashboard } from "@/components/controle-pj/PJDashboard";
import { useCardPermissions } from "@/hooks/useCardPermissions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function ControlePJPage() {
  const navigate = useNavigate();
  const { hasCardPermission, isLoading: permissionsLoading } = useCardPermissions();

  // Buscar o card "Controle PJ" para verificar permissão
  const { data: pjCard, isLoading: cardLoading } = useQuery({
    queryKey: ["ec-controle-pj-card"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ec_cards")
        .select("id, title")
        .or("title.ilike.%controle pj%,title.ilike.%controle de pj%")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

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

  // Verificar permissão no card
  if (pjCard && !hasCardPermission(pjCard.id, "view")) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <ShieldAlert className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground text-lg">Você não tem permissão para acessar o Controle PJ</p>
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
            <h1 className="text-3xl font-bold text-foreground">Controle PJ</h1>
            <p className="text-muted-foreground mt-1">
              Gestão de colaboradores PJ: contratos, fechamentos, folgas e holerites
            </p>
          </div>
        </div>
        {pjCard && <PJDashboard cardId={pjCard.id} />}
      </div>
    </MainLayout>
  );
}
