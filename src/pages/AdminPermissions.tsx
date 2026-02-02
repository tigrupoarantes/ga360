import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/external-client";
import { useToast } from "@/hooks/use-toast";
import { Search, Shield, Save, Building2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  company_id: string | null;
}

interface UserPermission {
  user_id: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface Company {
  id: string;
  name: string;
}

interface UserCompanyPermission {
  company_id: string;
  can_view: boolean;
}

const MODULES = [
  { id: 'dashboard_executivo', label: 'Dashboard Executivo' },
  { id: 'dashboard_pessoal', label: 'Dashboard Pessoal' },
  { id: 'meetings', label: 'Reuniões' },
  { id: 'calendar', label: 'Calendário' },
  { id: 'tasks', label: 'Tarefas' },
  { id: 'processes', label: 'Processos' },
  { id: 'trade', label: 'Trade Marketing' },
  { id: 'reports', label: 'Relatórios' },
  { id: 'admin', label: 'Administração' },
];

const ACTIONS = [
  { id: 'can_view', label: 'Visualizar' },
  { id: 'can_create', label: 'Criar' },
  { id: 'can_edit', label: 'Editar' },
  { id: 'can_delete', label: 'Excluir' },
];

export default function AdminPermissions() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, UserPermission>>({});
  const [companyPermissions, setCompanyPermissions] = useState<Record<string, boolean>>({});
  const [allCompanies, setAllCompanies] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchUserPermissions(selectedUser);
      fetchUserCompanyPermissions(selectedUser);
    }
  }, [selectedUser]);

  const fetchData = async () => {
    try {
      const [usersRes, companiesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url, company_id')
          .eq('is_active', true)
          .order('first_name'),
        supabase
          .from('companies')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),
      ]);

      if (usersRes.error) throw usersRes.error;
      if (companiesRes.error) throw companiesRes.error;

      setUsers(usersRes.data || []);
      setCompanies(companiesRes.data || []);
      
      if (usersRes.data && usersRes.data.length > 0) {
        setSelectedUser(usersRes.data[0].id);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPermissions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const permissionsMap: Record<string, UserPermission> = {};
      
      MODULES.forEach(module => {
        permissionsMap[module.id] = {
          user_id: userId,
          module: module.id,
          can_view: false,
          can_create: false,
          can_edit: false,
          can_delete: false,
        };
      });

      data?.forEach(perm => {
        permissionsMap[perm.module] = perm;
      });

      setPermissions(permissionsMap);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as permissões.",
        variant: "destructive",
      });
    }
  };

  const fetchUserCompanyPermissions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_companies')
        .select('company_id, can_view, all_companies')
        .eq('user_id', userId);

      if (error) throw error;

      const companyPermsMap: Record<string, boolean> = {};
      let hasAllCompanies = false;

      data?.forEach(perm => {
        if (perm.all_companies) {
          hasAllCompanies = true;
        }
        if (perm.company_id) {
          companyPermsMap[perm.company_id] = perm.can_view;
        }
      });

      setAllCompanies(hasAllCompanies);
      setCompanyPermissions(companyPermsMap);
    } catch (error) {
      console.error('Error fetching company permissions:', error);
    }
  };

  const togglePermission = (module: string, action: keyof UserPermission) => {
    setPermissions(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: !prev[module][action],
      },
    }));
  };

  const toggleCompanyPermission = (companyId: string) => {
    setCompanyPermissions(prev => ({
      ...prev,
      [companyId]: !prev[companyId],
    }));
  };

  const savePermissions = async () => {
    if (!selectedUser) return;

    setSaving(true);
    try {
      // Save module permissions
      const permissionsArray = Object.values(permissions);

      for (const perm of permissionsArray) {
        const { error } = await supabase
          .from('user_permissions')
          .upsert({
            user_id: perm.user_id,
            module: perm.module as any,
            can_view: perm.can_view,
            can_create: perm.can_create,
            can_edit: perm.can_edit,
            can_delete: perm.can_delete,
          }, {
            onConflict: 'user_id,module'
          });

        if (error) throw error;
      }

      // Delete existing company permissions for this user
      await supabase
        .from('user_companies')
        .delete()
        .eq('user_id', selectedUser);

      // Save "all companies" permission if enabled
      if (allCompanies) {
        const { error } = await supabase
          .from('user_companies')
          .insert({
            user_id: selectedUser,
            company_id: null,
            all_companies: true,
            can_view: true,
          });

        if (error) throw error;
      } else {
        // Save individual company permissions
        const companyPermsToSave = Object.entries(companyPermissions)
          .filter(([_, canView]) => canView)
          .map(([companyId]) => ({
            user_id: selectedUser,
            company_id: companyId,
            all_companies: false,
            can_view: true,
          }));

        if (companyPermsToSave.length > 0) {
          const { error } = await supabase
            .from('user_companies')
            .insert(companyPermsToSave);

          if (error) throw error;
        }
      }

      toast({
        title: "Sucesso",
        description: "Permissões atualizadas com sucesso.",
      });
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as permissões.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase());
  });

  const selectedUserProfile = users.find(u => u.id === selectedUser);
  const selectedUserCompany = selectedUserProfile?.company_id 
    ? companies.find(c => c.id === selectedUserProfile.company_id)
    : null;

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
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
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              Gestão de Permissões
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure permissões granulares por usuário
            </p>
          </div>
          <Button onClick={savePermissions} disabled={saving || !selectedUser} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* User Selection Panel */}
          <Card className="lg:col-span-1 p-4">
            <div className="space-y-4">
              <div>
                <Label>Buscar Usuário</Label>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nome do usuário..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user.id)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedUser === user.id
                        ? 'bg-primary/10 border-2 border-primary'
                        : 'bg-muted/30 hover:bg-muted/50 border-2 border-transparent'
                    }`}
                  >
                    <p className="font-medium text-sm">
                      {user.first_name} {user.last_name}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Permissions Configuration Panel */}
          <Card className="lg:col-span-3 p-6">
            {selectedUser && selectedUserProfile ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-semibold text-primary">
                      {selectedUserProfile.first_name?.[0]}{selectedUserProfile.last_name?.[0]}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">
                      {selectedUserProfile.first_name} {selectedUserProfile.last_name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedUserCompany 
                        ? `Empresa principal: ${selectedUserCompany.name}`
                        : 'Configurando permissões de acesso'
                      }
                    </p>
                  </div>
                </div>

                <Tabs defaultValue="dashboard" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="dashboard">Dashboards</TabsTrigger>
                    <TabsTrigger value="modules">Módulos</TabsTrigger>
                    <TabsTrigger value="admin">Administração</TabsTrigger>
                    <TabsTrigger value="companies" className="gap-1">
                      <Building2 className="h-4 w-4" />
                      Empresas
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="dashboard" className="space-y-4 mt-6">
                    {MODULES.filter(m => m.id.startsWith('dashboard')).map(module => (
                      <Card key={module.id} className="p-4">
                        <h3 className="font-semibold mb-4">{module.label}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {ACTIONS.map(action => (
                            <div key={action.id} className="flex items-center justify-between">
                              <Label htmlFor={`${module.id}-${action.id}`} className="text-sm">
                                {action.label}
                              </Label>
                              <Switch
                                id={`${module.id}-${action.id}`}
                                checked={permissions[module.id]?.[action.id as keyof UserPermission] as boolean}
                                onCheckedChange={() => togglePermission(module.id, action.id as keyof UserPermission)}
                              />
                            </div>
                          ))}
                        </div>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="modules" className="space-y-4 mt-6">
                    {MODULES.filter(m => !m.id.startsWith('dashboard') && m.id !== 'admin').map(module => (
                      <Card key={module.id} className="p-4">
                        <h3 className="font-semibold mb-4">{module.label}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {ACTIONS.map(action => (
                            <div key={action.id} className="flex items-center justify-between">
                              <Label htmlFor={`${module.id}-${action.id}`} className="text-sm">
                                {action.label}
                              </Label>
                              <Switch
                                id={`${module.id}-${action.id}`}
                                checked={permissions[module.id]?.[action.id as keyof UserPermission] as boolean}
                                onCheckedChange={() => togglePermission(module.id, action.id as keyof UserPermission)}
                              />
                            </div>
                          ))}
                        </div>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="admin" className="space-y-4 mt-6">
                    {MODULES.filter(m => m.id === 'admin').map(module => (
                      <Card key={module.id} className="p-4">
                        <h3 className="font-semibold mb-4">{module.label}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {ACTIONS.map(action => (
                            <div key={action.id} className="flex items-center justify-between">
                              <Label htmlFor={`${module.id}-${action.id}`} className="text-sm">
                                {action.label}
                              </Label>
                              <Switch
                                id={`${module.id}-${action.id}`}
                                checked={permissions[module.id]?.[action.id as keyof UserPermission] as boolean}
                                onCheckedChange={() => togglePermission(module.id, action.id as keyof UserPermission)}
                              />
                            </div>
                          ))}
                        </div>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="companies" className="space-y-4 mt-6">
                    <Card className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold">Acesso a Empresas</h3>
                          <p className="text-sm text-muted-foreground">
                            Permite visualizar dados de outras empresas além da empresa principal
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {/* All companies toggle */}
                        <div className="flex items-center space-x-3 p-4 rounded-lg border border-primary/20 bg-primary/5">
                          <Checkbox
                            id="all-companies"
                            checked={allCompanies}
                            onCheckedChange={(checked) => setAllCompanies(checked === true)}
                          />
                          <div className="flex-1">
                            <Label htmlFor="all-companies" className="font-medium cursor-pointer">
                              Acesso a todas as empresas
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Habilita visualização de dados de todas as empresas do sistema
                            </p>
                          </div>
                        </div>

                        {/* Individual company permissions */}
                        {!allCompanies && (
                          <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground">
                              Ou selecione empresas específicas:
                            </Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {companies.map(company => {
                                const isMainCompany = selectedUserProfile?.company_id === company.id;
                                return (
                                  <div
                                    key={company.id}
                                    className={`flex items-center space-x-3 p-3 rounded-lg border ${
                                      isMainCompany 
                                        ? 'border-primary bg-primary/10' 
                                        : 'border-border'
                                    }`}
                                  >
                                    <Checkbox
                                      id={`company-${company.id}`}
                                      checked={isMainCompany || companyPermissions[company.id] === true}
                                      disabled={isMainCompany}
                                      onCheckedChange={() => toggleCompanyPermission(company.id)}
                                    />
                                    <div className="flex-1">
                                      <Label 
                                        htmlFor={`company-${company.id}`} 
                                        className={`cursor-pointer ${isMainCompany ? 'font-medium' : ''}`}
                                      >
                                        {company.name}
                                      </Label>
                                      {isMainCompany && (
                                        <p className="text-xs text-primary">Empresa principal</p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="flex items-center justify-center h-96">
                <p className="text-muted-foreground">Selecione um usuário para configurar permissões</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
