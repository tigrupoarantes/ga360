import { useParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { BackButton } from "@/components/ui/back-button";
import { ECAreaView } from "@/components/governanca-ec/ECAreaView";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { Skeleton } from "@/components/ui/skeleton";

export default function GovernancaECArea() {
  const { areaSlug } = useParams<{ areaSlug: string }>();

  const { data: area, isLoading } = useQuery({
    queryKey: ['ec-area', areaSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ec_areas')
        .select('*')
        .eq('slug', areaSlug)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!areaSlug,
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

  if (!area) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Área não encontrada</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <BackButton to="/governanca-ec" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">{area.name}</h1>
            <p className="text-muted-foreground mt-1">
              {area.description || `Cards da área ${area.name}`}
            </p>
          </div>
        </div>

        <ECAreaView areaId={area.id} areaName={area.name} />
      </div>
    </MainLayout>
  );
}
