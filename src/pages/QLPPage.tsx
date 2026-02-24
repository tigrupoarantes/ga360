import { MainLayout } from "@/components/layout/MainLayout";
import { BackButton } from "@/components/ui/back-button";
import { QLPDrillDown } from "@/components/governanca-ec/QLPDrillDown";
import { useCardPermissions } from "@/hooks/useCardPermissions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function QLPPage() {
  const navigate = useNavigate();
  const { hasCardPermission, isLoading: permissionsLoading } = useCardPermissions();

  // Find the QLP card to check permissions
  const { data: qlpCard, isLoading: cardLoading } = useQuery({
    queryKey: ['ec-qlp-card'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ec_cards')
        .select('id, title')
        .or('title.ilike.%qlp%,title.ilike.%quadro de lotação%,title.ilike.%quadro de lotacao%')
        .eq('is_active', true)
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

  // Check card-level permission if we found the QLP card
  if (qlpCard && !hasCardPermission(qlpCard.id, 'view')) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <ShieldAlert className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground text-lg">Você não tem permissão para acessar o QLP</p>
          <Button variant="outline" onClick={() => navigate('/governanca-ec/pessoas-cultura')}>
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
            <h1 className="text-3xl font-bold text-foreground">QLP - Quadro de Lotação de Pessoal</h1>
            <p className="text-muted-foreground mt-1">
              Visualização drill-down da força de trabalho por empresa, unidade (categoria) e nome
            </p>
          </div>
        </div>
        <QLPDrillDown />
      </div>
    </MainLayout>
  );
}
