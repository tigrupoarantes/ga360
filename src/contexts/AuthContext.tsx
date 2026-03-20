import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/external-client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  area_id: string | null;
  avatar_url: string | null;
  phone: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: string | null;
  loading: boolean;
  // 2FA state
  requires2FA: boolean;
  pending2FAUserId: string | null;
  pending2FAEmail: string | null;
  pending2FAHasPhone: boolean;
  // Auth methods
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  // 2FA methods
  send2FACode: (method: 'email' | 'whatsapp') => Promise<{ error?: string; destination?: string; expiresAt?: string }>;
  verify2FACode: (code: string) => Promise<{ error?: string }>;
  cancel2FA: () => void;
  checkPermission: (module: string, action?: string) => boolean;
  permissions: UserPermission[];
  hasAllCompaniesAccess: boolean;
}

interface UserPermission {
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hierarquia de prioridade das roles (índice menor = maior prioridade)
const ROLE_PRIORITY: Record<string, number> = {
  super_admin: 0,
  ceo: 1,
  diretor: 2,
  gerente: 3,
  colaborador: 4,
};

// 🔧 FLAG TEMPORÁRIA: Desativar 2FA enquanto configura domínio Resend
// TODO: Remover esta flag após validar domínio em resend.com/domains
const SKIP_2FA_TEMPORARILY = true;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [hasAllCompaniesAccess, setHasAllCompaniesAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [pending2FAUserId, setPending2FAUserId] = useState<string | null>(null);
  const [pending2FAEmail, setPending2FAEmail] = useState<string | null>(null);
  const [pending2FAHasPhone, setPending2FAHasPhone] = useState(false);
  const [pendingSession, setPendingSession] = useState<Session | null>(null);

  const { toast } = useToast();

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
      return data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  };

  const markPendingInviteAsAccepted = async (email: string | undefined) => {
    if (!email) return;
    try {
      const { error } = await supabase
        .from('user_invites')
        .update({ status: 'accepted' })
        .eq('email', email)
        .eq('status', 'pending');
      if (error) console.error('Error updating invite status:', error);
    } catch (e) {
      console.error('Error marking invite as accepted:', e);
    }
  };

  const fetchPermissions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching permissions:', error);
        return;
      }

      if (data) {
        setPermissions(data.map(p => ({
          module: p.module,
          can_view: p.can_view,
          can_create: p.can_create,
          can_edit: p.can_edit,
          can_delete: p.can_delete
        })));
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setPermissions([]);
    }
  };

  const fetchCompanyPermissions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_companies')
        .select('all_companies')
        .eq('user_id', userId)
        .eq('all_companies', true)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "The result contains 0 rows" which is fine
        console.error('Error fetching company permissions:', error);
      }

      setHasAllCompaniesAccess(data?.all_companies || false);
    } catch (error) {
      console.error('Error fetching company permissions:', error);
      setHasAllCompaniesAccess(false);
    }
  };

  const checkPermission = (module: string, action: string = 'view'): boolean => {
    // Senior roles have full access — avoids gaps in granular permission tables
    if (['super_admin', 'ceo', 'diretor'].includes(role ?? '')) return true;

    // Check granular permissions for other roles
    const permission = permissions.find(p => p.module === module);
    if (!permission) return false;

    switch (action) {
      case 'view': return permission.can_view;
      case 'create': return permission.can_create;
      case 'edit': return permission.can_edit;
      case 'delete': return permission.can_delete;
      default: return false;
    }
  };

  const fetchRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Erro ao buscar roles:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const roles = data.map(r => r.role as string);

        const sortedRoles = roles.sort((a, b) => {
          const priorityA = ROLE_PRIORITY[a] ?? 99;
          const priorityB = ROLE_PRIORITY[b] ?? 99;
          return priorityA - priorityB;
        });

        setRole(sortedRoles[0]);
      } else {
        console.log('⚠️ Nenhuma role encontrada para o usuário');
        setRole(null);
      }
    } catch (error) {
      console.error('💥 Error fetching role:', error);
      setRole(null);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Só atualizar se não estivermos aguardando 2FA
        if (!requires2FA) {
          setSession(session);
          setUser(session?.user ?? null);

          // Defer Supabase calls with setTimeout to prevent deadlock
          if (session?.user) {
            setTimeout(() => {
              fetchProfile(session.user.id);
              fetchRole(session.user.id);
              fetchPermissions(session.user.id);
              fetchCompanyPermissions(session.user.id);
              markPendingInviteAsAccepted(session.user.email);
            }, 0);
          } else {
            setProfile(null);
            setRole(null);
            setPermissions([]);
          }
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!requires2FA) {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          fetchProfile(session.user.id);
          fetchRole(session.user.id);
          fetchPermissions(session.user.id);
          fetchCompanyPermissions(session.user.id);
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [requires2FA]);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: 'Erro ao fazer login',
          description: error.message === 'Invalid login credentials'
            ? 'Email ou senha incorretos'
            : error.message,
          variant: 'destructive',
        });
        return { error };
      }

      // Login bem-sucedido
      if (data.user && data.session) {
        // 🔧 FLAG TEMPORÁRIA: Pular 2FA
        if (SKIP_2FA_TEMPORARILY) {
          console.warn('[Auth] 2FA desativado — remover SKIP_2FA_TEMPORARILY antes do deploy');
          toast({
            title: 'Login realizado!',
            description: 'Bem-vindo de volta.',
          });
          return { error: null };
        }

        // Buscar perfil para verificar se tem telefone
        const profileData = await fetchProfile(data.user.id);
        const hasPhone = !!profileData?.phone;

        // Fazer signOut silencioso para não liberar acesso ainda
        await supabase.auth.signOut();

        // Configurar estado 2FA
        setPending2FAUserId(data.user.id);
        setPending2FAEmail(data.user.email || email);
        setPending2FAHasPhone(hasPhone);
        setPendingSession(data.session);
        setRequires2FA(true);

        return { error: null };
      }

      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const send2FACode = async (method: 'email' | 'whatsapp'): Promise<{ error?: string; destination?: string; expiresAt?: string }> => {
    if (!pending2FAUserId) {
      return { error: 'Usuário não identificado' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('send-2fa-code', {
        body: { userId: pending2FAUserId, method },
      });

      if (error) {
        console.error('Erro ao enviar código 2FA:', error);
        return { error: 'Erro ao enviar código. Tente novamente.' };
      }

      if (data.error) {
        return { error: data.error };
      }

      return {
        destination: data.destination,
        expiresAt: data.expiresAt,
      };
    } catch (error: any) {
      console.error('Erro ao enviar código 2FA:', error);
      return { error: 'Erro ao enviar código. Tente novamente.' };
    }
  };

  const verify2FACode = async (code: string): Promise<{ error?: string }> => {
    if (!pending2FAUserId || !pending2FAEmail) {
      return { error: 'Sessão expirada. Faça login novamente.' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('verify-2fa-code', {
        body: { userId: pending2FAUserId, code },
      });

      if (error) {
        console.error('Erro ao verificar código 2FA:', error);
        return { error: 'Erro ao verificar código. Tente novamente.' };
      }

      if (data.error) {
        return { error: data.error };
      }

      // Código verificado com sucesso - restaurar sessão

      // Limpar estado 2FA
      setRequires2FA(false);
      setPending2FAUserId(null);
      setPending2FAEmail(null);
      setPending2FAHasPhone(false);
      setPendingSession(null);

      // Forçar nova verificação de sessão (o usuário precisará fazer login novamente)
      // Isso é uma limitação - idealmente manteríamos a sessão, mas por segurança
      // fazemos o usuário relogar após 2FA verificado
      toast({
        title: 'Verificação concluída!',
        description: 'Agora você pode acessar o sistema.',
      });

      // Refazer login automaticamente usando credenciais armazenadas temporariamente
      // Como não temos a senha, pedimos para o usuário clicar em entrar novamente
      // Alternativamente, podemos armazenar um token de sessão

      return {};
    } catch (error: any) {
      console.error('Erro ao verificar código 2FA:', error);
      return { error: 'Erro ao verificar código. Tente novamente.' };
    }
  };

  const cancel2FA = () => {
    setRequires2FA(false);
    setPending2FAUserId(null);
    setPending2FAEmail(null);
    setPending2FAHasPhone(false);
    setPendingSession(null);
  };

  const signUp = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ) => {
    try {
      const redirectUrl = `${window.location.origin}/`;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      });

      if (error) {
        toast({
          title: 'Erro ao criar conta',
          description: error.message === 'User already registered'
            ? 'Este email já está cadastrado'
            : error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Conta criada com sucesso!',
          description: 'Você já pode fazer login.',
        });
      }

      return { error };
    } catch (error: any) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      setRole(null);
      cancel2FA();

      toast({
        title: 'Logout realizado',
        description: 'Você foi desconectado com sucesso.',
      });
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const appUrl = (
        import.meta.env.VITE_PUBLIC_SITE_URL ||
        import.meta.env.VITE_APP_URL ||
        window.location.origin
      ).replace(/\/$/, '');

      const { error } = await supabase.functions.invoke('request-password-reset', {
        body: {
          email,
          appUrl,
        },
      });

      if (error) {
        toast({
          title: 'Erro ao enviar email',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Email enviado!',
          description: 'Se o email existir em nossa base, você receberá as instruções de recuperação.',
        });
      }

      return { error };
    } catch (error: any) {
      return { error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        permissions,
        loading,
        requires2FA,
        pending2FAUserId,
        pending2FAEmail,
        pending2FAHasPhone,
        signIn,
        signUp,
        signOut,
        resetPassword,
        send2FACode,
        verify2FACode,
        cancel2FA,
        checkPermission,
        hasAllCompaniesAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
