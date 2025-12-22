-- Criar tabela para códigos de autenticação 2FA
CREATE TABLE public.two_factor_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  method text NOT NULL CHECK (method IN ('email', 'whatsapp')),
  expires_at timestamp with time zone NOT NULL,
  verified boolean DEFAULT false,
  attempts integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Índices para consultas frequentes
CREATE INDEX idx_two_factor_codes_user_id ON public.two_factor_codes(user_id);
CREATE INDEX idx_two_factor_codes_expires_at ON public.two_factor_codes(expires_at);
CREATE INDEX idx_two_factor_codes_code ON public.two_factor_codes(code);

-- Habilitar RLS
ALTER TABLE public.two_factor_codes ENABLE ROW LEVEL SECURITY;

-- Política: Sistema pode gerenciar códigos (via service role)
CREATE POLICY "System can manage 2fa codes"
ON public.two_factor_codes
FOR ALL
USING (true)
WITH CHECK (true);

-- Função para limpar códigos expirados (pode ser chamada periodicamente)
CREATE OR REPLACE FUNCTION public.cleanup_expired_2fa_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.two_factor_codes
  WHERE expires_at < now() OR verified = true;
END;
$$;