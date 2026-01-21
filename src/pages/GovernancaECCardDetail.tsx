import { useParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { BackButton } from "@/components/ui/back-button";
import { ECCardDetail } from "@/components/governanca-ec/ECCardDetail";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export default function GovernancaECCardDetail() {
  const { areaSlug, cardId } = useParams<{ areaSlug: string; cardId: string }>();

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

  if (isLoading) {
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

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <BackButton fallbackPath={`/governanca-ec/${areaSlug}`} />
          <div>
            <h1 className="text-3xl font-bold text-foreground">{card.title}</h1>
            <p className="text-muted-foreground mt-1">
              {card.description || `Detalhes do card`}
            </p>
          </div>
        </div>

        <ECCardDetail card={card} />
      </div>
    </MainLayout>
  );
}
