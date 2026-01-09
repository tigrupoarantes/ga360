import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { Loader2, UserPlus, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import TwoFactorAuth from '@/components/auth/TwoFactorAuth';
import logoBadge from '@/assets/logo-crescer-badge.png';

const loginSchema = z.object({
  email: z.string().trim().email({ message: 'Email inválido' }),
  password: z.string().min(6, { message: 'A senha deve ter no mínimo 6 caracteres' }),
});

const signupSchema = z.object({
  firstName: z.string().trim().min(2, { message: 'Nome deve ter no mínimo 2 caracteres' }),
  lastName: z.string().trim().min(2, { message: 'Sobrenome deve ter no mínimo 2 caracteres' }),
  email: z.string().trim().email({ message: 'Email inválido' }),
  password: z.string().min(6, { message: 'A senha deve ter no mínimo 6 caracteres' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

interface InviteData {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  roles: string[];
  company_id: string | null;
  area_id: string | null;
}

export default function Auth() {
  const { 
    user, 
    signIn, 
    signUp, 
    requires2FA, 
    pending2FAEmail, 
    pending2FAHasPhone,
    send2FACode,
    verify2FACode,
    cancel2FA,
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [mounted, setMounted] = useState(false);
  const [is2FALoading, setIs2FALoading] = useState(false);

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check for invite token in URL
  useEffect(() => {
    const inviteToken = searchParams.get('invite');
    if (inviteToken) {
      validateInvite(inviteToken);
    }
  }, [searchParams]);

  const validateInvite = async (token: string) => {
    setInviteLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_invites')
        .select('id, email, first_name, last_name, roles, company_id, area_id')
        .eq('token', token)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        console.error('Invalid or expired invite:', error);
        return;
      }

      setInviteData(data);
      setSignupData({
        firstName: data.first_name || '',
        lastName: data.last_name || '',
        email: data.email,
        password: '',
        confirmPassword: '',
      });
      setActiveTab('signup');
    } catch (error) {
      console.error('Error validating invite:', error);
    } finally {
      setInviteLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      const validated = loginSchema.parse(loginData);
      await signIn(validated.email, validated.password);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      const validated = signupSchema.parse(signupData);
      const { error } = await signUp(
        validated.email,
        validated.password,
        validated.firstName,
        validated.lastName
      );

      if (!error && inviteData) {
        // Mark invite as accepted
        await supabase
          .from('user_invites')
          .update({ status: 'accepted' })
          .eq('id', inviteData.id);
      }

      if (!error) {
        setSignupData({
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          confirmPassword: '',
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FASendCode = async (method: 'email' | 'whatsapp') => {
    return await send2FACode(method);
  };

  const handle2FAVerifyCode = async (code: string) => {
    setIs2FALoading(true);
    const result = await verify2FACode(code);
    setIs2FALoading(false);
    
    if (!result.error) {
      // Verificação bem-sucedida - fazer login novamente
      // Como fizemos signOut antes do 2FA, precisamos relogar
      setLoginData({ email: '', password: '' });
    }
    
    return result;
  };

  if (inviteLoading) {
    return (
      <div className="auth-page">
        <div className="auth-gradient" />
        <div className="auth-orbs">
          <div className="auth-orb auth-orb-1" />
          <div className="auth-orb auth-orb-2" />
          <div className="auth-orb auth-orb-3" />
        </div>
        <Loader2 className="h-8 w-8 animate-spin text-primary relative z-10" />
      </div>
    );
  }

  return (
    <div className="auth-page">
      {/* Animated Background */}
      <div className="auth-gradient" />
      <div className="auth-orbs">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
      </div>

      {/* Content */}
      <div className={cn(
        "relative z-10 w-full max-w-md px-6 transition-all duration-700",
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      )}>
        {/* Logo */}
        <div className={cn(
          "text-center mb-8 transition-all duration-700 delay-100",
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}>
          <div className="mb-6 transition-transform hover:scale-105">
            <img 
              src={logoBadge} 
              alt="CRESCER+ & MELHOR" 
              className="h-32 w-auto mx-auto drop-shadow-2xl"
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            CRESCER+ & MELHOR
          </h1>
          <p className="text-muted-foreground mt-2 text-sm font-medium">
            MISSÃO.1BI: 365 DIAS DE JORNADA
          </p>
        </div>

        {/* Card */}
        <div className={cn(
          "auth-card transition-all duration-700 delay-200",
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}>
          {/* 2FA Screen */}
          {requires2FA ? (
            <TwoFactorAuth
              userEmail={pending2FAEmail || ''}
              hasPhone={pending2FAHasPhone}
              onSendCode={handle2FASendCode}
              onVerifyCode={handle2FAVerifyCode}
              onCancel={cancel2FA}
              isLoading={is2FALoading}
            />
          ) : (
            <>
              {inviteData && (
                <Alert className="mb-6 border-primary/20 bg-primary/5 animate-fade-in">
                  <UserPlus className="h-4 w-4" />
                  <AlertDescription>
                    Você foi convidado para se cadastrar como <strong>{inviteData.roles.join(', ')}</strong>.
                  </AlertDescription>
                </Alert>
              )}

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-secondary/50 p-1 rounded-xl">
                  <TabsTrigger 
                    value="login" 
                    className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                  >
                    Login
                  </TabsTrigger>
                  <TabsTrigger 
                    value="signup"
                    className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                  >
                    Cadastro
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-6">
                  <form onSubmit={handleLogin} className="space-y-5">
                    <div className={cn(
                      "space-y-2 transition-all duration-500 delay-300",
                      mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                    )}>
                      <Label htmlFor="login-email" className="text-sm font-medium">
                        Email
                      </Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={loginData.email}
                        onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                        className={cn(
                          "h-12 bg-secondary/30 border-0 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20 transition-all",
                          errors.email && 'ring-2 ring-destructive/50'
                        )}
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive animate-fade-in">{errors.email}</p>
                      )}
                    </div>

                    <div className={cn(
                      "space-y-2 transition-all duration-500 delay-400",
                      mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                    )}>
                      <Label htmlFor="login-password" className="text-sm font-medium">
                        Senha
                      </Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        className={cn(
                          "h-12 bg-secondary/30 border-0 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20 transition-all",
                          errors.password && 'ring-2 ring-destructive/50'
                        )}
                      />
                      {errors.password && (
                        <p className="text-sm text-destructive animate-fade-in">{errors.password}</p>
                      )}
                    </div>

                    <div className={cn(
                      "pt-2 transition-all duration-500 delay-500",
                      mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                    )}>
                      <Button 
                        type="submit" 
                        className="w-full h-12 rounded-xl font-medium text-base group transition-all hover:shadow-lg hover:shadow-primary/25" 
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            Entrar
                            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                          </>
                        )}
                      </Button>
                    </div>

                    <div className={cn(
                      "transition-all duration-500 delay-[600ms]",
                      mounted ? "opacity-100" : "opacity-0"
                    )}>
                      <Button
                        type="button"
                        variant="link"
                        className="w-full text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => navigate('/reset-password')}
                      >
                        Esqueceu sua senha?
                      </Button>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-6">
                  <form onSubmit={handleSignup} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-firstName" className="text-sm font-medium">
                          Nome
                        </Label>
                        <Input
                          id="signup-firstName"
                          type="text"
                          placeholder="João"
                          value={signupData.firstName}
                          onChange={(e) => setSignupData({ ...signupData, firstName: e.target.value })}
                          className={cn(
                            "h-12 bg-secondary/30 border-0 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20",
                            errors.firstName && 'ring-2 ring-destructive/50'
                          )}
                        />
                        {errors.firstName && (
                          <p className="text-sm text-destructive animate-fade-in">{errors.firstName}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-lastName" className="text-sm font-medium">
                          Sobrenome
                        </Label>
                        <Input
                          id="signup-lastName"
                          type="text"
                          placeholder="Silva"
                          value={signupData.lastName}
                          onChange={(e) => setSignupData({ ...signupData, lastName: e.target.value })}
                          className={cn(
                            "h-12 bg-secondary/30 border-0 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20",
                            errors.lastName && 'ring-2 ring-destructive/50'
                          )}
                        />
                        {errors.lastName && (
                          <p className="text-sm text-destructive animate-fade-in">{errors.lastName}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-sm font-medium">
                        Email
                      </Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={signupData.email}
                        onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                        className={cn(
                          "h-12 bg-secondary/30 border-0 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20",
                          errors.email && 'ring-2 ring-destructive/50'
                        )}
                        readOnly={!!inviteData}
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive animate-fade-in">{errors.email}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-sm font-medium">
                        Senha
                      </Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={signupData.password}
                        onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                        className={cn(
                          "h-12 bg-secondary/30 border-0 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20",
                          errors.password && 'ring-2 ring-destructive/50'
                        )}
                      />
                      {errors.password && (
                        <p className="text-sm text-destructive animate-fade-in">{errors.password}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-confirmPassword" className="text-sm font-medium">
                        Confirmar Senha
                      </Label>
                      <Input
                        id="signup-confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        value={signupData.confirmPassword}
                        onChange={(e) =>
                          setSignupData({ ...signupData, confirmPassword: e.target.value })
                        }
                        className={cn(
                          "h-12 bg-secondary/30 border-0 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20",
                          errors.confirmPassword && 'ring-2 ring-destructive/50'
                        )}
                      />
                      {errors.confirmPassword && (
                        <p className="text-sm text-destructive animate-fade-in">{errors.confirmPassword}</p>
                      )}
                    </div>

                    <div className="pt-2">
                      <Button 
                        type="submit" 
                        className="w-full h-12 rounded-xl font-medium text-base group transition-all hover:shadow-lg hover:shadow-primary/25" 
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            Criar conta
                            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>

        {/* Footer */}
        <p className={cn(
          "text-center text-sm text-muted-foreground mt-8 transition-all duration-700 delay-300",
          mounted ? "opacity-100" : "opacity-0"
        )}>
          © {new Date().getFullYear()} GA 360. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
