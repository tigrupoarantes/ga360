import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/external-client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';

const passwordSchema = z.object({
  newPassword: z
    .string()
    .min(8, { message: 'A senha deve ter no mínimo 8 caracteres' })
    .regex(/[A-Z]/, { message: 'A senha deve conter pelo menos uma letra maiúscula' })
    .regex(/[a-z]/, { message: 'A senha deve conter pelo menos uma letra minúscula' })
    .regex(/[0-9]/, { message: 'A senha deve conter pelo menos um número' }),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

export default function ChangePassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  // Processar token da URL e estabelecer sessão
  useEffect(() => {
    const processTokenFromUrl = async () => {
      setSessionLoading(true);
      
      // Verificar se há hash com token na URL
      const hash = window.location.hash;
      console.log('ChangePassword: Verificando hash na URL:', hash ? 'presente' : 'ausente');
      
      if (hash && (hash.includes('access_token') || hash.includes('type=recovery'))) {
        console.log('ChangePassword: Token encontrado na URL, aguardando processamento...');
        
        // Aguardar o Supabase processar o hash automaticamente
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Verificar sessão atual
      const { data: { session }, error } = await supabase.auth.getSession();
      
      console.log('ChangePassword: Sessão verificada:', session ? 'ativa' : 'inativa', error ? `Erro: ${error.message}` : '');
      
      if (error) {
        console.error('ChangePassword: Erro ao verificar sessão:', error);
        toast({
          title: 'Erro de autenticação',
          description: 'Seu link expirou ou é inválido. Solicite um novo.',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }
      
      if (session) {
        console.log('ChangePassword: Sessão válida para usuário:', session.user.email);
        setHasSession(true);
      } else {
        // Se não há hash e não há sessão, redirecionar
        if (!hash || (!hash.includes('access_token') && !hash.includes('type=recovery'))) {
          toast({
            title: 'Sessão não encontrada',
            description: 'Por favor, faça login ou solicite um novo link.',
            variant: 'destructive',
          });
          navigate('/auth');
        } else {
          // Token presente mas sessão não estabelecida ainda - tentar novamente
          console.log('ChangePassword: Aguardando processamento do token...');
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession) {
            console.log('ChangePassword: Sessão estabelecida após retry');
            setHasSession(true);
          } else {
            toast({
              title: 'Erro ao processar link',
              description: 'O link expirou ou é inválido. Solicite um novo.',
              variant: 'destructive',
            });
            navigate('/auth');
          }
        }
      }
      
      setSessionLoading(false);
    };

    processTokenFromUrl();
  }, [navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const validated = passwordSchema.parse(formData);

      const { error } = await supabase.auth.updateUser({
        password: validated.newPassword,
      });

      if (error) throw error;

      toast({
        title: 'Senha alterada!',
        description: 'Sua senha foi atualizada com sucesso.',
      });

      // Clear form
      setFormData({
        newPassword: '',
        confirmPassword: '',
      });

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        console.error('ChangePassword: Erro ao alterar senha:', error);
        toast({
          title: 'Erro ao alterar senha',
          description: 'Não foi possível alterar sua senha. Tente novamente.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Se ainda está carregando a sessão, mostrar loading
  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Se não tem sessão, não renderizar (já foi redirecionado)
  if (!hasSession) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center animate-fade-in">
          <h1 className="text-3xl font-bold text-foreground">Alterar Senha</h1>
          <p className="text-muted-foreground mt-2">
            Defina uma nova senha para sua conta
          </p>
        </div>

        <Card className="p-6 animate-fade-in-up">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Security Requirements Info */}
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">
                Requisitos de segurança:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Mínimo de 8 caracteres</li>
                <li>Pelo menos uma letra maiúscula</li>
                <li>Pelo menos uma letra minúscula</li>
                <li>Pelo menos um número</li>
              </ul>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Digite sua nova senha"
                  value={formData.newPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, newPassword: e.target.value })
                  }
                  className={errors.newPassword ? 'border-destructive pr-10' : 'pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-sm text-destructive">{errors.newPassword}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Digite novamente sua nova senha"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  className={errors.confirmPassword ? 'border-destructive pr-10' : 'pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Alterando...
                </>
              ) : (
                'Alterar senha'
              )}
            </Button>
          </form>
        </Card>

        {/* Security Tips */}
        <Card className="p-6 bg-muted/30">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Dicas de segurança
          </h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Nunca compartilhe sua senha com outras pessoas</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Use senhas diferentes para cada serviço</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Considere usar um gerenciador de senhas</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Altere sua senha regularmente</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
