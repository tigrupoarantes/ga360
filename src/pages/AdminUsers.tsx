import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Search, Edit, Loader2, UserCheck, UserX, UserPlus } from 'lucide-react';
import { UserEditDialog } from '@/components/admin/UserEditDialog';
import { UserCreateDialog } from '@/components/admin/UserCreateDialog';

interface Area {
  id: string;
  name: string;
}

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  area_id: string | null;
  is_active: boolean;
  areas?: { name: string } | null;
}

interface UserWithDetails extends UserProfile {
  email?: string;
  roles?: string[];
}

const roleLabels: Record<string, string> = {
  ceo: 'CEO',
  diretor: 'Diretor',
  gerente: 'Gerente',
  colaborador: 'Colaborador',
};

const roleColors: Record<string, string> = {
  ceo: 'bg-primary text-primary-foreground',
  diretor: 'bg-secondary text-secondary-foreground',
  gerente: 'bg-accent text-accent-foreground',
  colaborador: 'bg-muted text-muted-foreground',
};

export default function AdminUsers() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterArea, setFilterArea] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<UserWithDetails | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch areas
      const { data: areasData, error: areasError } = await supabase
        .from('areas')
        .select('id, name')
        .order('name');

      if (areasError) throw areasError;
      setAreas(areasData || []);

      // Fetch profiles with areas
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name,
          area_id,
          is_active,
          areas:area_id (name)
        `)
        .order('first_name');

      if (profilesError) throw profilesError;

      // Fetch user emails from auth.users (requires admin access)
      // For now, we'll just use the profile data
      const usersWithDetails: UserWithDetails[] = await Promise.all(
        (profilesData || []).map(async (profile) => {
          // Fetch roles for each user
          const { data: rolesData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id);

          return {
            ...profile,
            roles: rolesData?.map((r) => r.role) || [],
          };
        })
      );

      setUsers(usersWithDetails);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Erro ao carregar usuários',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: UserWithDetails) => {
    setEditingUser(user);
    setDialogOpen(true);
  };

  const handleCreate = async (data: {
    email: string;
    first_name: string;
    last_name: string;
    area_id: string | null;
    roles: string[];
  }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Sessão não encontrada');
      }

      const response = await supabase.functions.invoke('create-user', {
        body: data,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: 'Usuário criado!',
        description: 'Um email de boas-vindas foi enviado ao novo usuário.',
      });

      fetchData();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: 'Erro ao criar usuário',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleSave = async (data: {
    first_name: string;
    last_name: string;
    area_id: string | null;
    is_active: boolean;
    roles: string[];
  }) => {
    if (!editingUser) return;

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          area_id: data.area_id,
          is_active: data.is_active,
        })
        .eq('id', editingUser.id);

      if (profileError) throw profileError;

      // Update roles - delete all existing and insert new ones
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', editingUser.id);

      if (deleteError) throw deleteError;

      if (data.roles.length > 0) {
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert(
            data.roles.map((role) => ({
              user_id: editingUser.id,
              role: role as 'ceo' | 'diretor' | 'gerente' | 'colaborador',
            }))
          );

        if (insertError) throw insertError;
      }

      toast({
        title: 'Usuário atualizado!',
        description: 'As alterações foram salvas com sucesso.',
      });

      fetchData();
      setDialogOpen(false);
      setEditingUser(null);
    } catch (error: any) {
      console.error('Error saving user:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const filteredUsers = users.filter((user) => {
    // Search filter
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      user.first_name?.toLowerCase().includes(searchLower) ||
      user.last_name?.toLowerCase().includes(searchLower) ||
      user.id.toLowerCase().includes(searchLower);

    // Role filter
    const matchesRole =
      filterRole === 'all' || user.roles?.includes(filterRole);

    // Area filter
    const matchesArea = filterArea === 'all' || user.area_id === filterArea;

    // Status filter
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && user.is_active) ||
      (filterStatus === 'inactive' && !user.is_active);

    return matchesSearch && matchesRole && matchesArea && matchesStatus;
  });

  const activeUsers = users.filter((u) => u.is_active).length;
  const inactiveUsers = users.filter((u) => !u.is_active).length;

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-6">
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
                Gestão de Usuários
              </h1>
              <p className="text-muted-foreground mt-1">
                Administre usuários, permissões e acessos
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Criar Usuário
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Total de Usuários</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {users.length}
            </p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Ativos</p>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1">
              {activeUsers}
            </p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Inativos</p>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1">
              {inactiveUsers}
            </p>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="grid gap-4 md:grid-cols-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Role Filter */}
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os roles</SelectItem>
                <SelectItem value="ceo">CEO</SelectItem>
                <SelectItem value="diretor">Diretor</SelectItem>
                <SelectItem value="gerente">Gerente</SelectItem>
                <SelectItem value="colaborador">Colaborador</SelectItem>
              </SelectContent>
            </Select>

            {/* Area Filter */}
            <Select value={filterArea} onValueChange={setFilterArea}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as áreas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as áreas</SelectItem>
                {areas.map((area) => (
                  <SelectItem key={area.id} value={area.id}>
                    {area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Users List */}
        <Card className="animate-fade-in-up">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum usuário encontrado
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground font-semibold">
                        {user.first_name?.[0] || 'U'}
                        {user.last_name?.[0] || ''}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {user.first_name} {user.last_name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {user.areas && (
                            <span className="text-xs text-muted-foreground">
                              {user.areas.name}
                            </span>
                          )}
                          {!user.is_active && (
                            <Badge variant="outline" className="text-xs">
                              Inativo
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex flex-wrap gap-1">
                      {user.roles?.map((role) => (
                        <Badge
                          key={role}
                          className={`text-xs ${roleColors[role] || 'bg-muted'}`}
                        >
                          {roleLabels[role] || role}
                        </Badge>
                      ))}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(user)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Info */}
        <Card className="p-6 bg-muted/30">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Sobre a gestão de usuários
          </h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                Usuários podem ter múltiplos roles simultaneamente
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                Usuários inativos são bloqueados automaticamente do sistema
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                Associe usuários a áreas para organizar a estrutura
              </span>
            </li>
          </ul>
        </Card>
      </div>

      <UserEditDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingUser(null);
        }}
        user={editingUser}
        areas={areas}
        onSave={handleSave}
      />

      <UserCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        areas={areas}
        onSave={handleCreate}
      />
    </MainLayout>
  );
}
