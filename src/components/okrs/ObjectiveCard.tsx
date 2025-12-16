import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Edit,
  Trash2,
  Plus,
  Target,
} from "lucide-react";
import { KeyResultFormDialog } from "./KeyResultFormDialog";
import { KeyResultUpdateDialog } from "./KeyResultUpdateDialog";
import { cn } from "@/lib/utils";

interface ObjectiveCardProps {
  objective: any;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  hasChildren: boolean;
  isChild?: boolean;
}

const levelLabels: Record<string, string> = {
  company: "Empresa",
  area: "Área",
  team: "Time",
  individual: "Individual",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-primary/20 text-primary",
  completed: "bg-green-500/20 text-green-500",
  cancelled: "bg-destructive/20 text-destructive",
};

export function ObjectiveCard({
  objective,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  hasChildren,
  isChild = false,
}: ObjectiveCardProps) {
  const [showKeyResults, setShowKeyResults] = useState(false);
  const [isKRFormOpen, setIsKRFormOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [selectedKR, setSelectedKR] = useState<any>(null);

  const keyResults = objective.okr_key_results || [];
  const progress = objective.progress || 0;

  const getProgressColor = (value: number) => {
    if (value >= 70) return "text-green-500";
    if (value >= 30) return "text-amber-500";
    return "text-destructive";
  };

  const handleUpdateKR = (kr: any) => {
    setSelectedKR(kr);
    setIsUpdateOpen(true);
  };

  return (
    <>
      <Card className={cn(
        "bg-card/50 backdrop-blur-sm border-border/50 transition-all",
        isChild && "border-l-4 border-l-primary/50"
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2 flex-1">
              {hasChildren && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={onToggleExpand}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              )}
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold">{objective.title}</h3>
                  <Badge variant="outline" className="text-xs">
                    {levelLabels[objective.level]}
                  </Badge>
                  <Badge className={cn("text-xs", statusColors[objective.status])}>
                    {statusLabels[objective.status]}
                  </Badge>
                </div>
                {objective.description && (
                  <p className="text-sm text-muted-foreground">{objective.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {objective.owner && (
                    <span>
                      Responsável: {objective.owner.first_name} {objective.owner.last_name}
                    </span>
                  )}
                  {objective.area && <span>Área: {objective.area.name}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className={cn("text-2xl font-bold", getProgressColor(progress))}>
                  {Math.round(progress)}%
                </p>
                <Progress value={progress} className="w-24 h-2" />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsKRFormOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar KR
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => setShowKeyResults(!showKeyResults)}
          >
            <Target className="h-4 w-4 mr-2" />
            {keyResults.length} Key Results
            {showKeyResults ? (
              <ChevronDown className="h-4 w-4 ml-auto" />
            ) : (
              <ChevronRight className="h-4 w-4 ml-auto" />
            )}
          </Button>

          {showKeyResults && (
            <div className="mt-4 space-y-3">
              {keyResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum Key Result definido
                </p>
              ) : (
                keyResults.map((kr: any) => {
                  const krProgress = kr.target_value > kr.start_value
                    ? ((kr.current_value - kr.start_value) / (kr.target_value - kr.start_value)) * 100
                    : 0;

                  return (
                    <div
                      key={kr.id}
                      className="p-3 rounded-lg bg-background/50 border border-border/50 cursor-pointer hover:bg-background/80 transition-colors"
                      onClick={() => handleUpdateKR(kr)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{kr.title}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            kr.status === "completed" && "bg-green-500/20 text-green-500",
                            kr.status === "at_risk" && "bg-amber-500/20 text-amber-500",
                            kr.status === "behind" && "bg-destructive/20 text-destructive"
                          )}
                        >
                          {kr.current_value} / {kr.target_value} {kr.unit}
                        </Badge>
                      </div>
                      <Progress value={Math.min(100, Math.max(0, krProgress))} className="h-2" />
                    </div>
                  );
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <KeyResultFormDialog
        open={isKRFormOpen}
        onOpenChange={setIsKRFormOpen}
        objectiveId={objective.id}
      />

      <KeyResultUpdateDialog
        open={isUpdateOpen}
        onOpenChange={setIsUpdateOpen}
        keyResult={selectedKR}
      />
    </>
  );
}
