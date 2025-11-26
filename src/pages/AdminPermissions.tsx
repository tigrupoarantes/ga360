import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, Shield, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

interface UserPermission {
  user_id: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
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
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, UserPermission>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchUserPermissions(selectedUser);
    }
  }, [selectedUser]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .eq('is_active', true)
        .order('first_name');

      if (error) throw error;
      setUsers(data || []);
      if (data && data.length > 0) {
        setSelectedUser(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os usuários.",
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
      
      // Initialize all modules with default permissions
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

      // Override with existing permissions
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

  const togglePermission = (module: string, action: keyof UserPermission) => {
    setPermissions(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: !prev[module][action],
      },
    }));
  };

  const savePermissions = async () => {
    if (!selectedUser) return;

    setSaving(true);
    try {
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
                      Configurando permissões de acesso
                    </p>
                  </div>
                </div>

                <Tabs defaultValue="dashboard" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="dashboard">Dashboards</TabsTrigger>
                    <TabsTrigger value="modules">Módulos</TabsTrigger>
                    <TabsTrigger value="admin">Administração</TabsTrigger>
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
