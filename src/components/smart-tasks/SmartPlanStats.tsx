import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Clock, Play, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface SmartPlanStatsProps {
  total: number;
  naoIniciado: number;
  emAndamento: number;
  concluido: number;
  atrasado: number;
  cancelado: number;
}

export function SmartPlanStats({
  total,
  naoIniciado,
  emAndamento,
  concluido,
  atrasado,
  cancelado,
}: SmartPlanStatsProps) {
  const cards = [
    { label: "Total", value: total, icon: ClipboardList, color: "text-foreground" },
    { label: "Não Iniciado", value: naoIniciado, icon: Clock, color: "text-muted-foreground" },
    { label: "Em Andamento", value: emAndamento, icon: Play, color: "text-primary" },
    { label: "Concluído", value: concluido, icon: CheckCircle2, color: "text-green-500" },
    { label: "Atrasado", value: atrasado, icon: AlertTriangle, color: "text-destructive" },
    { label: "Cancelado", value: cancelado, icon: XCircle, color: "text-muted-foreground" },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <Card key={card.label} className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium">{card.label}</CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
