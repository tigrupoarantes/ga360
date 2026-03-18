import { ExternalEmployeesList } from "@/components/employees/ExternalEmployeesList";

export default function AdminEmployees() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Funcionários Externos</h1>
        <p className="text-muted-foreground mt-1">
          Funcionários sincronizados do sistema Gestão de Ativos
        </p>
      </div>

      <ExternalEmployeesList />
    </div>
  );
}
