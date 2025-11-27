import { Badge } from "@/components/ui/badge";

interface ReportExamplesProps {
  onSelect: (query: string) => void;
  disabled?: boolean;
}

const examples = [
  {
    label: "Reuniões do Mês",
    query: "Gere um relatório completo das reuniões deste mês, incluindo quantidade por tipo, status e taxa de conclusão",
  },
  {
    label: "Tarefas Atrasadas",
    query: "Liste todas as tarefas atrasadas, agrupadas por responsável e prioridade, com sugestões de ação",
  },
  {
    label: "Taxa de Presença",
    query: "Análise da taxa de confirmação e presença em reuniões, por empresa e área",
  },
  {
    label: "Resumo Executivo",
    query: "Resumo executivo consolidado: reuniões, tarefas e decisões das últimas 2 semanas",
  },
  {
    label: "KPIs por Empresa",
    query: "Dashboard de KPIs por empresa: reuniões realizadas, tarefas concluídas, ATAs aprovadas",
  },
  {
    label: "Decisões Recentes",
    query: "Liste as principais decisões tomadas nas últimas reuniões e seus responsáveis",
  },
];

export function ReportExamples({ onSelect, disabled }: ReportExamplesProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {examples.map((example) => (
        <Badge
          key={example.label}
          variant="outline"
          className="cursor-pointer hover:bg-accent transition-colors px-3 py-1.5"
          onClick={() => !disabled && onSelect(example.query)}
        >
          {example.label}
        </Badge>
      ))}
    </div>
  );
}
