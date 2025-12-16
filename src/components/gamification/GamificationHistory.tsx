import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Zap,
  CheckCircle,
  Users,
  Target,
  FileText,
  Calendar,
  TrendingUp,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PointsHistoryEntry {
  id: string;
  points: number;
  action_type: string;
  description: string | null;
  created_at: string;
}

const ACTION_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  task_completed: { icon: CheckCircle, label: "Tarefa Concluída", color: "text-success" },
  meeting_attended: { icon: Users, label: "Participou de Reunião", color: "text-primary" },
  meeting_created: { icon: Calendar, label: "Reunião Criada", color: "text-info" },
  goal_achieved: { icon: Target, label: "Meta Alcançada", color: "text-warning" },
  ata_approved: { icon: FileText, label: "ATA Aprovada", color: "text-accent" },
  streak_bonus: { icon: TrendingUp, label: "Bônus de Streak", color: "text-destructive" },
  badge_earned: { icon: Award, label: "Badge Conquistada", color: "text-warning" },
  level_up: { icon: Zap, label: "Subiu de Nível", color: "text-primary" },
};

export function GamificationHistory() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<PointsHistoryEntry[]>([]);

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  const fetchHistory = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data } = await supabase
        .from("points_history")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      setHistory(data || []);
    } catch (error) {
      console.error("Error fetching points history:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Pontos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">
            Nenhuma atividade registrada ainda. Comece a usar a plataforma para ganhar pontos!
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group by date
  const groupedHistory = history.reduce((acc, entry) => {
    const date = format(new Date(entry.created_at), "yyyy-MM-dd");
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(entry);
    return acc;
  }, {} as Record<string, PointsHistoryEntry[]>);

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle>Histórico de Pontos</CardTitle>
        <CardDescription>Suas atividades e pontos ganhos</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Object.entries(groupedHistory).map(([date, entries]) => (
            <div key={date}>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                {format(new Date(date), "EEEE, d 'de' MMMM", { locale: ptBR })}
              </h4>
              <div className="space-y-2">
                {entries.map((entry) => {
                  const config = ACTION_CONFIG[entry.action_type] || {
                    icon: Zap,
                    label: entry.action_type,
                    color: "text-muted-foreground",
                  };
                  const Icon = config.icon;

                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-fast"
                    >
                      <div className={cn("p-2 rounded-lg bg-muted", config.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{config.label}</p>
                        {entry.description && (
                          <p className="text-sm text-muted-foreground truncate">
                            {entry.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={entry.points > 0 ? "default" : "destructive"}
                          className="font-mono"
                        >
                          {entry.points > 0 ? "+" : ""}
                          {entry.points} pts
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(entry.created_at), "HH:mm")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
