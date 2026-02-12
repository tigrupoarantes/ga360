import { MainLayout } from "@/components/layout/MainLayout";
import { BackButton } from "@/components/ui/back-button";
import { QLPDrillDown } from "@/components/governanca-ec/QLPDrillDown";

export default function QLPPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <BackButton to="/governanca-ec/pessoas-cultura" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">QLP - Quadro de Lotação de Pessoal</h1>
            <p className="text-muted-foreground mt-1">
              Visualização drill-down da força de trabalho por empresa e departamento
            </p>
          </div>
        </div>
        <QLPDrillDown />
      </div>
    </MainLayout>
  );
}
