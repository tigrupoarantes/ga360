import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Loader2, Mail, MessageSquare, ArrowLeft, RefreshCw, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TwoFactorAuthProps {
  userEmail: string;
  hasPhone: boolean;
  onSendCode: (method: 'email' | 'whatsapp') => Promise<{ error?: string; destination?: string; expiresAt?: string }>;
  onVerifyCode: (code: string) => Promise<{ error?: string }>;
  onCancel: () => void;
  isLoading: boolean;
}

type Step = 'method' | 'verify';

export default function TwoFactorAuth({
  userEmail,
  hasPhone,
  onSendCode,
  onVerifyCode,
  onCancel,
  isLoading,
}: TwoFactorAuthProps) {
  const [step, setStep] = useState<Step>('method');
  const [selectedMethod, setSelectedMethod] = useState<'email' | 'whatsapp' | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [destination, setDestination] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (expiresAt) {
      const updateCountdown = () => {
        const now = new Date();
        const diff = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
        setCountdown(diff);
        
        if (diff === 0) {
          setError('Código expirado. Solicite um novo código.');
        }
      };
      
      updateCountdown();
      const interval = setInterval(updateCountdown, 1000);
      return () => clearInterval(interval);
    }
  }, [expiresAt]);

  // Resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSelectMethod = async (method: 'email' | 'whatsapp') => {
    setSelectedMethod(method);
    setSendingCode(true);
    setError('');

    const result = await onSendCode(method);
    
    setSendingCode(false);
    
    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.destination) {
      setDestination(result.destination);
    }
    if (result.expiresAt) {
      setExpiresAt(new Date(result.expiresAt));
    }
    setResendCooldown(60); // 60 segundos para reenviar
    setStep('verify');
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      setError('Digite o código completo de 6 dígitos');
      return;
    }

    setError('');
    const result = await onVerifyCode(code);
    
    if (result.error) {
      setError(result.error);
      setCode('');
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || !selectedMethod) return;
    
    setSendingCode(true);
    setError('');
    setCode('');

    const result = await onSendCode(selectedMethod);
    
    setSendingCode(false);
    
    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.expiresAt) {
      setExpiresAt(new Date(result.expiresAt));
    }
    setResendCooldown(60);
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Mascarar email para exibição
  const maskedEmail = userEmail ? `${userEmail.slice(0, 2)}***@${userEmail.split('@')[1]}` : '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-2">
          <Shield className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Verificação em Duas Etapas</h2>
        <p className="text-sm text-muted-foreground">
          {step === 'method' 
            ? 'Escolha como deseja receber o código de verificação'
            : `Digite o código enviado para ${destination}`
          }
        </p>
      </div>

      {step === 'method' ? (
        /* Seleção de método */
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full h-16 justify-start gap-4 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all"
            onClick={() => handleSelectMethod('email')}
            disabled={sendingCode}
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10">
              <Mail className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-left flex-1">
              <p className="font-medium">Email</p>
              <p className="text-xs text-muted-foreground">{maskedEmail}</p>
            </div>
            {sendingCode && selectedMethod === 'email' && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
          </Button>

          <Button
            variant="outline"
            className={cn(
              "w-full h-16 justify-start gap-4 rounded-xl transition-all",
              hasPhone 
                ? "hover:border-primary/50 hover:bg-primary/5" 
                : "opacity-50 cursor-not-allowed"
            )}
            onClick={() => hasPhone && handleSelectMethod('whatsapp')}
            disabled={!hasPhone || sendingCode}
          >
            <div className={cn(
              "flex items-center justify-center w-10 h-10 rounded-lg",
              hasPhone ? "bg-green-500/10" : "bg-muted"
            )}>
              <MessageSquare className={cn(
                "h-5 w-5",
                hasPhone ? "text-green-500" : "text-muted-foreground"
              )} />
            </div>
            <div className="text-left flex-1">
              <p className="font-medium">WhatsApp</p>
              <p className="text-xs text-muted-foreground">
                {hasPhone ? 'Receber via mensagem' : 'Telefone não cadastrado'}
              </p>
            </div>
            {sendingCode && selectedMethod === 'whatsapp' && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
          </Button>

          {error && (
            <p className="text-sm text-destructive text-center animate-fade-in">{error}</p>
          )}

          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={onCancel}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao login
          </Button>
        </div>
      ) : (
        /* Verificação do código */
        <div className="space-y-6">
          {/* Input OTP */}
          <div className="flex flex-col items-center gap-4">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              disabled={isLoading || countdown === 0}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>

            {/* Countdown */}
            {countdown > 0 && (
              <p className="text-sm text-muted-foreground">
                Código expira em <span className="font-mono font-medium text-foreground">{formatCountdown(countdown)}</span>
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive text-center animate-fade-in">{error}</p>
          )}

          {/* Botões */}
          <div className="space-y-3">
            <Button
              className="w-full h-12 rounded-xl"
              onClick={handleVerifyCode}
              disabled={code.length !== 6 || isLoading || countdown === 0}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Verificar código'
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full rounded-xl"
              onClick={handleResendCode}
              disabled={resendCooldown > 0 || sendingCode}
            >
              {sendingCode ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {resendCooldown > 0 
                ? `Reenviar em ${resendCooldown}s` 
                : 'Reenviar código'
              }
            </Button>

            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => {
                setStep('method');
                setCode('');
                setError('');
                setSelectedMethod(null);
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Escolher outro método
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
