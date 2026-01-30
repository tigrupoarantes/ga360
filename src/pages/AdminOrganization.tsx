import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/ui/back-button';
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CompanyFormDialog } from '@/components/admin/CompanyFormDialog';
import { AreaFormDialog } from '@/components/admin/AreaFormDialog';
import { AreaTreeView } from '@/components/admin/AreaTreeView';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Company {
  id: string;
  name: string;
  cnpj?: string;
  is_active: boolean;
  is_auditable?: boolean;
  logo_url?: string;
  color?: string;
}

interface Area {
  id: string;
  name: string;
  parent_id: string | null;
  company_id: string | null;
  cost_center?: string | null;
}

export default function AdminOrganization() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [selectedCompanyForArea, setSelectedCompanyForArea] = useState<string | null>(null);
  const [deleteCompanyId, setDeleteCompanyId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [companiesResult, areasResult] = await Promise.all([
        supabase.from('companies').select('*').order('name'),
        supabase.from('areas').select('*').order('name'),
      ]);

      if (companiesResult.error) throw companiesResult.error;
      if (areasResult.error) throw areasResult.error;

      setCompanies(companiesResult.data || []);
      setAreas(areasResult.data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar dados',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = () => {
    setEditingCompany(null);
    setCompanyDialogOpen(true);
  };

  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    setCompanyDialogOpen(true);
  };

  const handleDeleteCompany = async () => {
    if (!deleteCompanyId) return;

    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', deleteCompanyId);

      if (error) throw error;

      toast({
        title: 'Empresa excluída',
        description: 'A empresa foi excluída com sucesso',
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir empresa',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeleteCompanyId(null);
    }
  };

  const handleCompanySuccess = () => {
    fetchData();
  };

  const handleCreateArea = (companyId: string) => {
    setSelectedCompanyForArea(companyId);
    setEditingArea(null);
    setAreaDialogOpen(true);
  };

  const handleEditArea = (area: Area) => {
    setSelectedCompanyForArea(area.company_id);
    setEditingArea(area);
    setAreaDialogOpen(true);
  };

  const handleSaveArea = async (data: any) => {
    try {
      const areaData = {
        ...data,
        company_id: selectedCompanyForArea,
      };

      if (editingArea) {
        const { error } = await supabase
          .from('areas')
          .update(areaData)
          .eq('id', editingArea.id);

        if (error) throw error;

        toast({
          title: 'Área atualizada',
          description: 'As informações da área foram atualizadas com sucesso',
        });
      } else {
        const { error } = await supabase.from('areas').insert(areaData);

        if (error) throw error;

        toast({
          title: 'Área criada',
          description: 'A área foi criada com sucesso',
        });
      }

      fetchData();
      setAreaDialogOpen(false);
    } catch (error: any) {
      throw error;
    }
  };

  const handleDeleteArea = async (areaId: string) => {
    try {
      const { error } = await supabase
        .from('areas')
        .delete()
        .eq('id', areaId);

      if (error) throw error;

      toast({
        title: 'Área excluída',
        description: 'A área foi excluída com sucesso',
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir área',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getCompanyAreas = (companyId: string) => {
    return areas.filter((area) => area.company_id === companyId);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <BackButton to="/admin" />
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Estrutura Organizacional
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie empresas e áreas do Grupo Arantes
            </p>
          </div>
          <Button onClick={handleCreateCompany} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Empresa
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company, index) => (
            <Card
              key={company.id}
              className="p-6 animate-fade-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${company.color}15` }}
                >
                  <Building2
                    className="h-6 w-6"
                    style={{ color: company.color || 'currentColor' }}
                  />
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditCompany(company)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteCompanyId(company.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-foreground mb-1">
                {company.name}
              </h3>
              {company.cnpj && (
                <p className="text-xs text-muted-foreground mb-4">
                  CNPJ: {company.cnpj}
                </p>
              )}

              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-foreground">
                    Áreas/Setores
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCreateArea(company.id)}
                    className="h-7 gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Nova Área
                  </Button>
                </div>

                {getCompanyAreas(company.id).length > 0 ? (
                  <div className="border rounded-md p-3 bg-muted/30">
                    <AreaTreeView
                      areas={getCompanyAreas(company.id)}
                      onEdit={handleEditArea}
                      onDelete={handleDeleteArea}
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Nenhuma área cadastrada
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>

        {companies.length === 0 && (
          <Card className="p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nenhuma empresa cadastrada
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Comece criando uma empresa para organizar sua estrutura
            </p>
            <Button onClick={handleCreateCompany} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar primeira empresa
            </Button>
          </Card>
        )}
      </div>

      <CompanyFormDialog
        open={companyDialogOpen}
        onOpenChange={setCompanyDialogOpen}
        company={editingCompany || undefined}
        onSuccess={handleCompanySuccess}
      />

      <AreaFormDialog
        open={areaDialogOpen}
        onOpenChange={setAreaDialogOpen}
        area={editingArea}
        areas={selectedCompanyForArea ? getCompanyAreas(selectedCompanyForArea) : []}
        onSave={handleSaveArea}
      />

      <AlertDialog
        open={!!deleteCompanyId}
        onOpenChange={() => setDeleteCompanyId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta empresa? Esta ação não pode ser
              desfeita e todas as áreas vinculadas também serão excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCompany}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
