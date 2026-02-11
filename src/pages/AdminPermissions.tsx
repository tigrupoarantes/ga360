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
import { Search, Shield, Save, Building2, LayoutGrid, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  company_id: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface ECCardInfo {
  id: string;
  title: string;
  area_name: string;
  area_id: string;
}

interface CardPermission {
  card_id: string;
  can_view: boolean;
  can_fill: boolean;
  can_review: boolean;
  can_manage: boolean;
}

const MODULES = [
  { id: 'meetings', label: 'Reuniões' },
  { id: 'calendar', label: 'Calendário' },
  { id: 'tasks', label: 'Tarefas' },
  { id: 'processes', label: 'Processos' },
  { id: 'trade', label: 'Trade Marketing' },
  { id: 'reports', label: 'Relatórios' },
  { id: 'governanca', label: 'Governança EC' },
];

const CARD_ACTIONS = [
  { id: 'can_view', label: 'Visualizar' },
  { id: 'can_fill', label: 'Preencher' },
  { id: 'can_review', label: 'Revisar' },
  { id: 'can_manage', label: 'Gerenciar' },
];

export default function AdminPermissions() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [ecCards, setEcCards] = useState<ECCardInfo[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [moduleAccess, setModuleAccess] = useState<Record<string, boolean>>({});
  const [cardPermissions, setCardPermissions] = useState<Record<string, CardPermission>>({});
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
      fetchUserCardPermissions(selectedUser);
    }
  }, [selectedUser]);

  const fetchData = async () => {
    try {
      const [usersRes, companiesRes, cardsRes] = await Promise.all([
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
        supabase
          .from('ec_cards')
          .select('id, title, area:ec_areas(id, name)')
          .eq('is_active', true)
          .order('order'),
      ]);

      if (usersRes.error) throw usersRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (cardsRes.error) throw cardsRes.error;

      setUsers(usersRes.data || []);
      setCompanies(companiesRes.data || []);
      setEcCards(
        (cardsRes.data || []).map((c: any) => ({
          id: c.id,
          title: c.title,
          area_name: c.area?.name || '',
          area_id: c.area?.id || '',
        }))
      );

      if (usersRes.data && usersRes.data.length > 0) {
        setSelectedUser(usersRes.data[0].id);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: "Erro", description: "Não foi possível carregar os dados.", variant: "destructive" });
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

      const accessMap: Record<string, boolean> = {};
      MODULES.forEach(m => { accessMap[m.id] = false; });
      data?.forEach(perm => { accessMap[perm.module] = perm.can_view; });
      setModuleAccess(accessMap);
    } catch (error) {
      console.error('Error fetching permissions:', error);
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
        if (perm.all_companies) hasAllCompanies = true;
        if (perm.company_id) companyPermsMap[perm.company_id] = perm.can_view;
      });
      setAllCompanies(hasAllCompanies);
      setCompanyPermissions(companyPermsMap);
    } catch (error) {
      console.error('Error fetching company permissions:', error);
    }
  };

  const fetchUserCardPermissions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('ec_card_permissions')
        .select('card_id, can_view, can_fill, can_review, can_manage')
        .eq('user_id', userId);

      if (error) throw error;

      const permsMap: Record<string, CardPermission> = {};
      data?.forEach(p => {
        permsMap[p.card_id] = p;
      });
      setCardPermissions(permsMap);
    } catch (error) {
      console.error('Error fetching card permissions:', error);
    }
  };

  const toggleModuleAccess = (moduleId: string) => {
    setModuleAccess(prev => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  const toggleCardPermission = (cardId: string, action: string) => {
    setCardPermissions(prev => {
      const existing = prev[cardId] || { card_id: cardId, can_view: false, can_fill: false, can_review: false, can_manage: false };
      return { ...prev, [cardId]: { ...existing, [action]: !(existing as any)[action] } };
    });
  };

  const toggleAllCardsAction = (action: string, value: boolean) => {
    setCardPermissions(prev => {
      const updated = { ...prev };
      ecCards.forEach(card => {
        const existing = updated[card.id] || { card_id: card.id, can_view: false, can_fill: false, can_review: false, can_manage: false };
        updated[card.id] = { ...existing, [action]: value };
      });
      return updated;
    });
  };

  const savePermissions = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      // Save module permissions (simplified to on/off via can_view)
      for (const mod of MODULES) {
        await supabase
          .from('user_permissions')
          .upsert({
            user_id: selectedUser,
            module: mod.id as any,
            can_view: moduleAccess[mod.id] || false,
            can_create: moduleAccess[mod.id] || false,
            can_edit: moduleAccess[mod.id] || false,
            can_delete: moduleAccess[mod.id] || false,
          }, { onConflict: 'user_id,module' });
      }

      // Save company permissions
      await supabase.from('user_companies').delete().eq('user_id', selectedUser);
      if (allCompanies) {
        await supabase.from('user_companies').insert({ user_id: selectedUser, company_id: null, all_companies: true, can_view: true });
      } else {
        const toSave = Object.entries(companyPermissions).filter(([_, v]) => v).map(([companyId]) => ({
          user_id: selectedUser, company_id: companyId, all_companies: false, can_view: true,
        }));
        if (toSave.length > 0) await supabase.from('user_companies').insert(toSave);
      }

      // Save card permissions
      await supabase.from('ec_card_permissions').delete().eq('user_id', selectedUser);
      const cardPermsToSave = Object.entries(cardPermissions)
        .filter(([_, p]) => p.can_view || p.can_fill || p.can_review || p.can_manage)
        .map(([cardId, p]) => ({
          user_id: selectedUser,
          card_id: cardId,
          can_view: p.can_view,
          can_fill: p.can_fill,
          can_review: p.can_review,
          can_manage: p.can_manage,
        }));
      if (cardPermsToSave.length > 0) {
        await supabase.from('ec_card_permissions').insert(cardPermsToSave);
      }

      toast({ title: "Sucesso", description: "Permissões atualizadas com sucesso." });
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast({ title: "Erro", description: "Não foi possível salvar as permissões.", variant: "destructive" });
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

  // Group cards by area
  const cardsByArea = ecCards.reduce((acc, card) => {
    if (!acc[card.area_name]) acc[card.area_name] = [];
    acc[card.area_name].push(card);
    return acc;
  }, {} as Record<string, ECCardInfo[]>);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
              Configure acesso a módulos, cards de governança e empresas
            </p>
          </div>
          <Button onClick={savePermissions} disabled={saving || !selectedUser} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* User Selection */}
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

          {/* Permissions Panel */}
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
                      {selectedUserCompany ? `Empresa: ${selectedUserCompany.name}` : 'Configurando permissões'}
                    </p>
                  </div>
                </div>

                <Tabs defaultValue="modules" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="modules">Módulos</TabsTrigger>
                    <TabsTrigger value="governanca" className="gap-1">
                      <LayoutGrid className="h-4 w-4" />
                      Governança EC
                    </TabsTrigger>
                    <TabsTrigger value="companies" className="gap-1">
                      <Building2 className="h-4 w-4" />
                      Empresas
                    </TabsTrigger>
                  </TabsList>

                  {/* Módulos - Acesso simples */}
                  <TabsContent value="modules" className="space-y-4 mt-6">
                    <Card className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold">Acesso aos Módulos</h3>
                          <p className="text-sm text-muted-foreground">
                            Ative ou desative o acesso completo a cada módulo. Dashboards são livres para todos.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {/* Info sobre dashboards */}
                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 mb-4">
                          <p className="text-sm text-green-700 dark:text-green-400">
                            ✓ <strong>Dashboards</strong> (Executivo e Pessoal) são acessíveis a todos os usuários ativos
                          </p>
                        </div>

                        {MODULES.map(mod => (
                          <div key={mod.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                            <div>
                              <Label className="font-medium cursor-pointer">{mod.label}</Label>
                            </div>
                            <Switch
                              checked={moduleAccess[mod.id] || false}
                              onCheckedChange={() => toggleModuleAccess(mod.id)}
                            />
                          </div>
                        ))}
                      </div>
                    </Card>
                  </TabsContent>

                  {/* Governança EC - Card-level */}
                  <TabsContent value="governanca" className="space-y-4 mt-6">
                    {!moduleAccess['governanca'] && (
                      <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                        <p className="text-sm text-yellow-700 dark:text-yellow-400">
                          ⚠ O módulo Governança EC está <strong>desativado</strong> para este usuário. Ative-o na aba "Módulos" primeiro.
                        </p>
                      </div>
                    )}

                    {/* Batch actions */}
                    <Card className="p-4">
                      <h3 className="font-semibold mb-3">Ações em lote</h3>
                      <div className="flex flex-wrap gap-2">
                        {CARD_ACTIONS.map(action => (
                          <div key={action.id} className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleAllCardsAction(action.id, true)}
                            >
                              {action.label} todos
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            CARD_ACTIONS.forEach(a => toggleAllCardsAction(a.id, false));
                          }}
                        >
                          Limpar todos
                        </Button>
                      </div>
                    </Card>

                    {Object.entries(cardsByArea).map(([areaName, cards]) => (
                      <Card key={areaName} className="p-4">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          {areaName}
                          <Badge variant="secondary" className="ml-auto">{cards.length} cards</Badge>
                        </h3>
                        <div className="space-y-2">
                          {/* Header */}
                          <div className="grid grid-cols-5 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground uppercase">
                            <span className="col-span-1">Card</span>
                            {CARD_ACTIONS.map(a => (
                              <span key={a.id} className="text-center">{a.label}</span>
                            ))}
                          </div>
                          {cards.map(card => {
                            const perm = cardPermissions[card.id] || { can_view: false, can_fill: false, can_review: false, can_manage: false };
                            return (
                              <div key={card.id} className="grid grid-cols-5 gap-2 items-center px-3 py-2 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                                <span className="text-sm font-medium truncate col-span-1" title={card.title}>
                                  {card.title}
                                </span>
                                {CARD_ACTIONS.map(action => (
                                  <div key={action.id} className="flex justify-center">
                                    <Checkbox
                                      checked={(perm as any)[action.id] || false}
                                      onCheckedChange={() => toggleCardPermission(card.id, action.id)}
                                    />
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    ))}

                    {ecCards.length === 0 && (
                      <Card className="p-8 text-center">
                        <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Nenhum card de Governança configurado.</p>
                      </Card>
                    )}
                  </TabsContent>

                  {/* Empresas */}
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
                        <div className="flex items-center space-x-3 p-4 rounded-lg border border-primary/20 bg-primary/5">
                          <Checkbox
                            id="all-companies"
                            checked={allCompanies}
                            onCheckedChange={(checked) => setAllCompanies(checked === true)}
                          />
                          <div className="flex-1">
                            <Label htmlFor="all-companies" className="font-medium cursor-pointer">
                              Todas as empresas
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Concede acesso a dados de todas as empresas do grupo
                            </p>
                          </div>
                        </div>

                        {!allCompanies && (
                          <div className="space-y-3 pl-2">
                            {companies.map(company => (
                              <div key={company.id} className="flex items-center space-x-3">
                                <Checkbox
                                  id={`company-${company.id}`}
                                  checked={companyPermissions[company.id] || false}
                                  onCheckedChange={() => {
                                    setCompanyPermissions(prev => ({
                                      ...prev,
                                      [company.id]: !prev[company.id],
                                    }));
                                  }}
                                />
                                <Label htmlFor={`company-${company.id}`} className="cursor-pointer">
                                  {company.name}
                                </Label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Selecione um usuário para configurar permissões</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
