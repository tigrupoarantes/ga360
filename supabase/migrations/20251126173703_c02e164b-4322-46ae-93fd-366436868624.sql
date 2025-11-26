-- Criar tabela system_settings para configurações globais
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: apenas super_admin e ceo podem gerenciar configurações
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin and CEO can view settings"
ON public.system_settings
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "Super admin and CEO can manage settings"
ON public.system_settings
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

-- Adicionar campo phone na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN public.profiles.phone IS 'Telefone em formato internacional: +5511999999999';

-- Trigger para atualizar updated_at em system_settings
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();