import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Loader2 } from 'lucide-react';
import { AreaTreeView } from '@/components/admin/AreaTreeView';
import { AreaFormDialog } from '@/components/admin/AreaFormDialog';

interface Area {
  id: string;
  name: string;
  parent_id: string | null;
}

export default function AdminAreas() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);

  useEffect(() => {
    fetchAreas();
  }, []);

  const fetchAreas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .order('name');

      if (error) throw error;
      setAreas(data || []);
    } catch (error: any) {
      console.error('Error fetching areas:', error);
      toast({
        title: 'Erro ao carregar áreas',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: { name: string; parent_id: string | null }) => {
    try {
      if (editingArea) {
        // Update
        const { error } = await supabase
          .from('areas')
          .update(data)
          .eq('id', editingArea.id);

        if (error) throw error;

        toast({
          title: 'Área atualizada!',
          description: 'As informações foram salvas com sucesso.',
        });
      } else {
        // Create
        const { error } = await supabase
          .from('areas')
          .insert([data]);

        if (error) throw error;

        toast({
          title: 'Área criada!',
          description: 'A nova área foi adicionada com sucesso.',
        });
      }

      fetchAreas();
      setDialogOpen(false);
      setEditingArea(null);
    } catch (error: any) {
      console.error('Error saving area:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleDelete = async (areaId: string) => {
    try {
      const { error } = await supabase
        .from('areas')
        .delete()
        .eq('id', areaId);

      if (error) throw error;

      toast({
        title: 'Área excluída',
        description: 'A área foi removida com sucesso.',
      });

      fetchAreas();
    } catch (error: any) {
      console.error('Error deleting area:', error);
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleEdit = (area: Area) => {
    setEditingArea(area);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditingArea(null);
    setDialogOpen(true);
  };

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="animate-fade-in">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Gestão de Áreas
              </h1>
              <p className="text-muted-foreground mt-1">
                Organize a estrutura hierárquica da empresa
              </p>
            </div>
            <Button onClick={handleNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Área
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Total de Áreas</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {areas.length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Áreas Raiz</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {areas.filter(a => !a.parent_id).length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Sub-áreas</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {areas.filter(a => a.parent_id).length}
            </p>
          </Card>
        </div>

        {/* Tree View */}
        <Card className="p-6 animate-fade-in-up">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground">
              Estrutura Organizacional
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AreaTreeView
              areas={areas}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </Card>

        {/* Info Card */}
        <Card className="p-6 bg-muted/30">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Sobre a hierarquia
          </h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                Áreas raiz são aquelas sem área superior (ex: Diretoria, Presidência)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                Sub-áreas herdam a hierarquia de suas áreas superiores
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                Use a hierarquia para organizar departamentos, times e projetos
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                Usuários podem ser associados a áreas em seus perfis
              </span>
            </li>
          </ul>
        </Card>
      </div>

      <AreaFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingArea(null);
        }}
        area={editingArea}
        areas={areas}
        onSave={handleSave}
      />
    </MainLayout>
  );
}
