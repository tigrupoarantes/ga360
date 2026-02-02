import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ECCard } from "./ECCard";
import { ECFilters } from "./ECFilters";
import { ECCardForm } from "./admin/ECCardForm";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutGrid, List, Plus, Search } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface ECAreaViewProps {
  areaId: string;
  areaName: string;
}

export function ECAreaView({ areaId, areaName }: ECAreaViewProps) {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCardForm, setShowCardForm] = useState(false);
  const [editingCard, setEditingCard] = useState<any>(null);
  const [deletingCard, setDeletingCard] = useState<any>(null);

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

  const deleteMutation = useMutation({
    mutationFn: async (cardId: string) => {
      const { error } = await supabase
        .from('ec_cards')
        .update({ is_active: false })
        .eq('id', cardId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ec-cards', areaId] });
      toast.success('Card excluído com sucesso');
      setDeletingCard(null);
    },
    onError: () => {
      toast.error('Erro ao excluir card');
    },
  });

  const handleEdit = (card: any) => {
    setEditingCard(card);
    setShowCardForm(true);
  };

  const handleDelete = (card: any) => {
    setDeletingCard(card);
  };

  const confirmDelete = () => {
    if (deletingCard) {
      deleteMutation.mutate(deletingCard.id);
    }
  };

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

  return (
    <div className="space-y-4">
      {/* Header com botão Novo Card */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{areaName}</h2>
        <Button onClick={() => setShowCardForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Card
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
          <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">Nenhum card nesta área</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Crie o primeiro card de {areaName} para começar a gerenciar entregáveis e tarefas.
          </p>
          <Button onClick={() => setShowCardForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Primeiro Card
          </Button>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCards?.map((card) => (
            <ECCard
              key={card.id} 
              card={card} 
              record={latestRecords?.[card.id]}
              viewMode="grid"
              onEdit={handleEdit}
              onDelete={handleDelete}
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
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Dialog Novo/Editar Card */}
      <ECCardForm
        open={showCardForm}
        onOpenChange={(open) => {
          setShowCardForm(open);
          if (!open) setEditingCard(null);
        }}
        card={editingCard}
        areas={[{ id: areaId, name: areaName }]}
        defaultAreaId={areaId}
      />

      {/* Dialog Confirmação de Exclusão */}
      <AlertDialog open={!!deletingCard} onOpenChange={(open) => !open && setDeletingCard(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir card</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o card "{deletingCard?.title}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
