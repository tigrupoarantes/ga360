import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Award,
  Footprints,
  Zap,
  Rocket,
  Clock,
  Users,
  CalendarPlus,
  Flame,
  Target,
  Trophy,
  Star,
  Crown,
  Medal,
  Lock,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BadgeData {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  condition_type: string;
  condition_value: number;
  earned?: boolean;
  earned_at?: string;
}

interface GamificationBadgesProps {
  showAll?: boolean;
  showEarned?: boolean;
}

const ICON_MAP: Record<string, any> = {
  award: Award,
  footprints: Footprints,
  zap: Zap,
  rocket: Rocket,
  clock: Clock,
  users: Users,
  "calendar-plus": CalendarPlus,
  flame: Flame,
  fire: Flame,
  target: Target,
  trophy: Trophy,
  star: Star,
  crown: Crown,
  medal: Medal,
};

const COLOR_MAP: Record<string, string> = {
  primary: "bg-primary/20 text-primary border-primary/30",
  success: "bg-success/20 text-success border-success/30",
  warning: "bg-warning/20 text-warning border-warning/30",
  destructive: "bg-destructive/20 text-destructive border-destructive/30",
  accent: "bg-accent/20 text-accent border-accent/30",
  info: "bg-info/20 text-info border-info/30",
};

const CATEGORY_LABELS: Record<string, string> = {
  tasks: "Tarefas",
  meetings: "Reuniões",
  goals: "Metas",
  engagement: "Engajamento",
  levels: "Níveis",
  ranking: "Ranking",
  general: "Geral",
};

export function GamificationBadges({ showAll, showEarned }: GamificationBadgesProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [badges, setBadges] = useState<BadgeData[]>([]);

  useEffect(() => {
    fetchBadges();
  }, [user]);

  const fetchBadges = async () => {
    setLoading(true);
    try {
      // Fetch all badges
      const { data: allBadges } = await supabase
        .from("badges")
        .select("*")
        .eq("is_active", true)
        .order("category", { ascending: true });

      if (user) {
        // Fetch earned badges
        const { data: earnedBadges } = await supabase
          .from("user_badges")
          .select("badge_id, earned_at")
          .eq("user_id", user.id);

        const earnedMap = new Map(earnedBadges?.map((b) => [b.badge_id, b.earned_at]));

        const enrichedBadges = allBadges?.map((badge) => ({
          ...badge,
          earned: earnedMap.has(badge.id),
          earned_at: earnedMap.get(badge.id),
        }));

        setBadges(enrichedBadges || []);
      } else {
        setBadges(allBadges || []);
      }
    } catch (error) {
      console.error("Error fetching badges:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBadges = showEarned
    ? badges.filter((b) => b.earned)
    : badges;

  const groupedBadges = filteredBadges.reduce((acc, badge) => {
    if (!acc[badge.category]) {
      acc[badge.category] = [];
    }
    acc[badge.category].push(badge);
    return acc;
  }, {} as Record<string, BadgeData[]>);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="h-24 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (showEarned && filteredBadges.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Medal className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">
            Você ainda não conquistou nenhuma badge. Continue usando a plataforma!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {Object.entries(groupedBadges).map(([category, categoryBadges]) => (
        <div key={category}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            {CATEGORY_LABELS[category] || category}
            <Badge variant="outline" className="font-normal">
              {categoryBadges.filter((b) => b.earned).length}/{categoryBadges.length}
            </Badge>
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categoryBadges.map((badge) => {
              const IconComponent = ICON_MAP[badge.icon] || Award;
              const colorClass = COLOR_MAP[badge.color] || COLOR_MAP.primary;

              return (
                <Card
                  key={badge.id}
                  className={cn(
                    "hover-lift transition-smooth relative overflow-hidden",
                    !badge.earned && "opacity-60 grayscale"
                  )}
                >
                  {badge.earned && (
                    <div className="absolute top-2 right-2">
                      <div className="bg-success text-success-foreground rounded-full p-1">
                        <Check className="h-3 w-3" />
                      </div>
                    </div>
                  )}
                  {!badge.earned && (
                    <div className="absolute top-2 right-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className={cn("p-3 rounded-xl border", colorClass)}>
                        <IconComponent className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{badge.name}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {badge.description}
                        </p>
                        {badge.earned && badge.earned_at && (
                          <p className="text-xs text-success mt-2">
                            Conquistada em {new Date(badge.earned_at).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                        {!badge.earned && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Requisito: {badge.condition_value}x {badge.condition_type.replace("_", " ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
