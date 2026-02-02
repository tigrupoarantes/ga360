import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/external-client";
import { useAuth } from "@/contexts/AuthContext";
import { Flame, Star, Zap, TrendingUp, Award, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserPointsData {
  points: number;
  level: number;
  streak_days: number;
  total_points_earned: number;
  rank?: number;
  badges_count?: number;
}

const LEVEL_COLORS = [
  "bg-muted text-muted-foreground",
  "bg-primary/20 text-primary",
  "bg-success/20 text-success",
  "bg-warning/20 text-warning",
  "bg-accent/20 text-accent",
  "bg-destructive/20 text-destructive",
];

export function GamificationProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UserPointsData | null>(null);

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get user points
      const { data: pointsData } = await supabase
        .from("user_points")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // Get user rank
      const { data: allPoints } = await supabase
        .from("user_points")
        .select("user_id, total_points_earned")
        .order("total_points_earned", { ascending: false });

      // Get badges count
      const { count: badgesCount } = await supabase
        .from("user_badges")
        .select("id", { count: "exact" })
        .eq("user_id", user.id);

      const rank = allPoints?.findIndex((p) => p.user_id === user.id) ?? -1;

      if (pointsData) {
        setData({
          ...pointsData,
          rank: rank >= 0 ? rank + 1 : undefined,
          badges_count: badgesCount || 0,
        });
      } else {
        // Create initial points record
        const { data: newData } = await supabase
          .from("user_points")
          .insert({ user_id: user.id })
          .select()
          .single();

        if (newData) {
          setData({ ...newData, rank: undefined, badges_count: 0 });
        }
      }
    } catch (error) {
      console.error("Error fetching user gamification data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateNextLevelPoints = (currentLevel: number) => {
    // Level formula: points_needed = (level^2) * 100
    return Math.pow(currentLevel, 2) * 100;
  };

  const calculateCurrentLevelPoints = (currentLevel: number) => {
    if (currentLevel <= 1) return 0;
    return Math.pow(currentLevel - 1, 2) * 100;
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="h-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const currentLevelPoints = calculateCurrentLevelPoints(data.level);
  const nextLevelPoints = calculateNextLevelPoints(data.level);
  const pointsInLevel = data.total_points_earned - currentLevelPoints;
  const pointsNeeded = nextLevelPoints - currentLevelPoints;
  const levelProgress = (pointsInLevel / pointsNeeded) * 100;

  const levelColor = LEVEL_COLORS[Math.min(data.level - 1, LEVEL_COLORS.length - 1)];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Main Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Level Card */}
        <Card className="hover-lift">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={cn("p-3 rounded-xl", levelColor)}>
                <Star className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Nível</p>
                <p className="text-3xl font-bold">{data.level}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Points Card */}
        <Card className="hover-lift">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/20 text-primary">
                <Zap className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Pontos Totais</p>
                <p className="text-3xl font-bold">{data.total_points_earned.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Streak Card */}
        <Card className="hover-lift">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-3 rounded-xl",
                data.streak_days >= 7 ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"
              )}>
                <Flame className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Streak</p>
                <p className="text-3xl font-bold">{data.streak_days} dias</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rank Card */}
        <Card className="hover-lift">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-accent/20 text-accent">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Ranking</p>
                <p className="text-3xl font-bold">
                  {data.rank ? `#${data.rank}` : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Level Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={levelColor}>
                Nível {data.level}
              </Badge>
              <span className="text-sm text-muted-foreground">→</span>
              <Badge variant="outline">Nível {data.level + 1}</Badge>
            </div>
            <span className="text-sm text-muted-foreground">
              {pointsInLevel.toLocaleString()} / {pointsNeeded.toLocaleString()} pts
            </span>
          </div>
          <Progress value={levelProgress} className="h-3" />
          <p className="text-xs text-muted-foreground mt-2">
            Faltam {(pointsNeeded - pointsInLevel).toLocaleString()} pontos para o próximo nível
          </p>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Award className="h-8 w-8 text-warning" />
              <div>
                <p className="text-2xl font-bold">{data.badges_count}</p>
                <p className="text-sm text-muted-foreground">Conquistas desbloqueadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Target className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold">{data.points}</p>
                <p className="text-sm text-muted-foreground">Pontos disponíveis</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
