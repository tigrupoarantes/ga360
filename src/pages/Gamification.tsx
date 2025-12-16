import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GamificationLeaderboard } from "@/components/gamification/GamificationLeaderboard";
import { GamificationBadges } from "@/components/gamification/GamificationBadges";
import { GamificationProfile } from "@/components/gamification/GamificationProfile";
import { GamificationHistory } from "@/components/gamification/GamificationHistory";
import { Trophy, Medal, User, History } from "lucide-react";

export default function Gamification() {
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold text-foreground">Gamificação</h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe seu progresso, conquiste badges e suba no ranking
          </p>
        </div>

        {/* Profile Summary */}
        <GamificationProfile />

        {/* Tabs */}
        <Tabs defaultValue="leaderboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="leaderboard" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">Ranking</span>
            </TabsTrigger>
            <TabsTrigger value="badges" className="flex items-center gap-2">
              <Medal className="h-4 w-4" />
              <span className="hidden sm:inline">Conquistas</span>
            </TabsTrigger>
            <TabsTrigger value="my-badges" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Minhas Badges</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leaderboard">
            <GamificationLeaderboard />
          </TabsContent>

          <TabsContent value="badges">
            <GamificationBadges showAll />
          </TabsContent>

          <TabsContent value="my-badges">
            <GamificationBadges showEarned />
          </TabsContent>

          <TabsContent value="history">
            <GamificationHistory />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
