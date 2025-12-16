import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Trophy, Medal, Award, Crown, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderboardUser {
  user_id: string;
  total_points_earned: number;
  level: number;
  streak_days: number;
  profile?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
}

const RANK_ICONS = [Crown, Trophy, Medal];
const RANK_COLORS = [
  "text-warning bg-warning/20",
  "text-muted-foreground bg-muted",
  "text-accent bg-accent/20",
];

export function GamificationLeaderboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const { data: pointsData } = await supabase
        .from("user_points")
        .select("user_id, total_points_earned, level, streak_days")
        .order("total_points_earned", { ascending: false })
        .limit(50);

      if (pointsData && pointsData.length > 0) {
        const userIds = pointsData.map((p) => p.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, avatar_url")
          .in("id", userIds);

        const profileMap = new Map(profiles?.map((p) => [p.id, p]));

        const enrichedData = pointsData.map((p) => ({
          ...p,
          profile: profileMap.get(p.user_id),
        }));

        setLeaderboard(enrichedData);
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ranking Global</CardTitle>
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

  if (leaderboard.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">
            Nenhum usuário no ranking ainda. Seja o primeiro!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top 3 Podium */}
      <div className="grid gap-4 md:grid-cols-3">
        {leaderboard.slice(0, 3).map((entry, index) => {
          const RankIcon = RANK_ICONS[index];
          const rankColor = RANK_COLORS[index];
          const name = entry.profile
            ? `${entry.profile.first_name || ""} ${entry.profile.last_name || ""}`.trim()
            : "Usuário";
          const initials = entry.profile
            ? `${entry.profile.first_name?.[0] || ""}${entry.profile.last_name?.[0] || ""}`.toUpperCase()
            : "U";

          return (
            <Card
              key={entry.user_id}
              className={cn(
                "hover-lift transition-smooth",
                index === 0 && "md:order-2 md:scale-105",
                index === 1 && "md:order-1",
                index === 2 && "md:order-3",
                entry.user_id === user?.id && "ring-2 ring-primary"
              )}
            >
              <CardContent className="pt-6 text-center">
                <div className={cn("inline-flex p-3 rounded-full mb-4", rankColor)}>
                  <RankIcon className="h-8 w-8" />
                </div>
                <Avatar className="h-16 w-16 mx-auto mb-3">
                  <AvatarImage src={entry.profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                </Avatar>
                <p className="font-semibold truncate">{name}</p>
                <p className="text-2xl font-bold text-primary mt-1">
                  {entry.total_points_earned.toLocaleString()} pts
                </p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Badge variant="outline">
                    <Star className="h-3 w-3 mr-1" />
                    Nível {entry.level}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Rest of Leaderboard */}
      {leaderboard.length > 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Ranking Completo</CardTitle>
            <CardDescription>Top 50 colaboradores</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {leaderboard.slice(3).map((entry, index) => {
                const rank = index + 4;
                const name = entry.profile
                  ? `${entry.profile.first_name || ""} ${entry.profile.last_name || ""}`.trim()
                  : "Usuário";
                const initials = entry.profile
                  ? `${entry.profile.first_name?.[0] || ""}${entry.profile.last_name?.[0] || ""}`.toUpperCase()
                  : "U";

                return (
                  <div
                    key={entry.user_id}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-fast",
                      entry.user_id === user?.id && "bg-primary/10 ring-1 ring-primary/20"
                    )}
                  >
                    <span className="w-8 text-center font-bold text-muted-foreground">
                      {rank}
                    </span>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={entry.profile?.avatar_url || undefined} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{name}</p>
                      <p className="text-sm text-muted-foreground">
                        Nível {entry.level} • {entry.streak_days} dias de streak
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{entry.total_points_earned.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">pontos</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
