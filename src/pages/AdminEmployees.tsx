import { MainLayout } from "@/components/layout/MainLayout";
import { BackButton } from "@/components/ui/back-button";
import { ExternalEmployeesList } from "@/components/employees/ExternalEmployeesList";

export default function AdminEmployees() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4 animate-fade-in">
          <BackButton to="/admin" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Funcionários Externos
            </h1>
            <p className="text-muted-foreground mt-1">
              Funcionários sincronizados do sistema Gestão de Ativos
            </p>
          </div>
        </div>

        <ExternalEmployeesList />
      </div>
    </MainLayout>
  );
}
