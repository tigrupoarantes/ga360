import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { BackButton } from "@/components/ui/back-button";
import { ECCardDetail } from "@/components/governanca-ec/ECCardDetail";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { Skeleton } from "@/components/ui/skeleton";
import { useCardPermissions } from "@/hooks/useCardPermissions";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GovernancaECCardDetail() {
  const { areaSlug, cardId } = useParams<{ areaSlug: string; cardId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialTab = searchParams.get('tab') || 'summary';
  const { hasCardPermission, isLoading: permissionsLoading } = useCardPermissions();

  const { data: card, isLoading } = useQuery({
    queryKey: ['ec-card', cardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ec_cards')
        .select(`
          *,
          area:ec_areas(*),
          responsible:profiles!ec_cards_responsible_id_fkey(id, first_name, last_name, avatar_url),
          backup:profiles!ec_cards_backup_id_fkey(id, first_name, last_name, avatar_url)
        `)
        .eq('id', cardId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!cardId,
  });

  if (isLoading || permissionsLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (!card) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Card não encontrado</p>
        </div>
      </MainLayout>
    );
  }

  // Check if user has at least view permission for this card
  if (cardId && !hasCardPermission(cardId, 'view')) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <ShieldAlert className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground text-lg">Você não tem permissão para acessar este card</p>
          <Button variant="outline" onClick={() => navigate(`/governanca-ec/${areaSlug}`)}>
            Voltar para a área
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <BackButton to={`/governanca-ec/${areaSlug}`} />
          <div>
            <h1 className="text-3xl font-bold text-foreground">{card.title}</h1>
            <p className="text-muted-foreground mt-1">
              {card.description || `Detalhes do card`}
            </p>
          </div>
        </div>

        <ECCardDetail card={card} initialTab={initialTab} />
      </div>
    </MainLayout>
  );
}
