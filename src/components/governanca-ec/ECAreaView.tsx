import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ECCard } from "./ECCard";
import { ECFilters } from "./ECFilters";
import { ECCardTaskForm } from "./ECCardTaskForm";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutGrid, List, Plus, Search } from "lucide-react";

interface ECAreaViewProps {
  areaId: string;
  areaName: string;
}

export function ECAreaView({ areaId, areaName }: ECAreaViewProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showTaskForm, setShowTaskForm] = useState(false);

  const { data: cards, isLoading } = useQuery({
    queryKey: ['ec-cards', areaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ec_cards')
        .select(`
          *,
          responsible:profiles!ec_cards_responsible_id_fkey(id, first_name, last_name, avatar_url),
          backup:profiles!ec_cards_backup_id_fkey(id, first_name, last_name, avatar_url)
        `)
        .eq('area_id', areaId)
        .eq('is_active', true)
        .order('order');
      
      if (error) throw error;
      return data;
    },
    enabled: !!areaId,
  });

  // Buscar o último registro de cada card para exibir status atual
  const { data: latestRecords } = useQuery({
    queryKey: ['ec-latest-records', areaId],
    queryFn: async () => {
      if (!cards || cards.length === 0) return {};

      const cardIds = cards.map(c => c.id);
      const { data, error } = await supabase
        .from('ec_card_records')
        .select('*')
        .in('card_id', cardIds)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      // Agrupar por card_id e pegar o mais recente
      const recordsByCard: Record<string, any> = {};
      data?.forEach(record => {
        if (!recordsByCard[record.card_id]) {
          recordsByCard[record.card_id] = record;
        }
      });

      return recordsByCard;
    },
    enabled: !!cards && cards.length > 0,
  });

  const filteredCards = cards?.filter(card => {
    const matchesSearch = card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          card.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === 'all') return matchesSearch;
    
    const record = latestRecords?.[card.id];
    return matchesSearch && record?.status === statusFilter;
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  const cardOptions = cards?.map(c => ({ id: c.id, title: c.title })) || [];

  return (
    <div className="space-y-4">
      {/* Header com botão Nova Tarefa */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{areaName}</h2>
        <Button onClick={() => setShowTaskForm(true)} disabled={!cards || cards.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Tarefa
        </Button>
      </div>

      {/* Filtros e controles */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <ECFilters 
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
        />
        <div className="flex gap-1 border rounded-md p-1">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Cards */}
      {filteredCards?.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Nenhum card encontrado</p>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCards?.map((card) => (
            <ECCard 
              key={card.id} 
              card={card} 
              record={latestRecords?.[card.id]}
              viewMode="grid"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCards?.map((card) => (
            <ECCard 
              key={card.id} 
              card={card} 
              record={latestRecords?.[card.id]}
              viewMode="list"
            />
          ))}
        </div>
      )}

      {/* Dialog Nova Tarefa */}
      <ECCardTaskForm
        open={showTaskForm}
        onOpenChange={setShowTaskForm}
        cards={cardOptions}
      />
    </div>
  );
}
