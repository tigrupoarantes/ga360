-- Adicionar campo is_active na tabela profiles
ALTER TABLE public.profiles
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- Criar índice para melhorar performance de buscas
CREATE INDEX idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX idx_profiles_area_id ON public.profiles(area_id);

-- Atualizar política RLS para considerar is_active
-- Usuários inativos não podem acessar o sistema
CREATE POLICY "Inactive users cannot access"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = id AND is_active = true
  );