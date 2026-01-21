import { MainLayout } from "@/components/layout/MainLayout";
import { ECDashboard } from "@/components/governanca-ec/ECDashboard";
import { BackButton } from "@/components/ui/back-button";

export default function GovernancaEC() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Governança EC</h1>
            <p className="text-muted-foreground mt-1">
              Acompanhamento de cards do Escritório Central
            </p>
          </div>
        </div>

        <ECDashboard />
      </div>
    </MainLayout>
  );
}
