-- Criar enum para roles (com verificação de existência)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('ceo', 'diretor', 'gerente', 'colaborador');
    END IF;
END$$;

-- Tabela de Áreas
CREATE TABLE public.areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Perfis
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Roles (SEPARADA para segurança)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Habilitar RLS
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função security definer para verificar roles (evita recursão RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Trigger para criar perfil automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inserir perfil
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', '')
  );
  
  -- Atribuir role padrão: colaborador
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'colaborador');
  
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Políticas RLS para PROFILES
-- Usuários podem ver seu próprio perfil
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Usuários podem atualizar seu próprio perfil
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- CEO pode ver todos os perfis
CREATE POLICY "CEO can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'ceo'));

-- CEO pode atualizar todos os perfis
CREATE POLICY "CEO can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'ceo'));

-- Políticas RLS para USER_ROLES
-- Usuários podem ver seus próprios roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Apenas CEO pode inserir roles
CREATE POLICY "Only CEO can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'ceo'));

-- Apenas CEO pode atualizar roles
CREATE POLICY "Only CEO can update roles"
  ON public.user_roles FOR UPDATE
  USING (public.has_role(auth.uid(), 'ceo'));

-- Apenas CEO pode deletar roles
CREATE POLICY "Only CEO can delete roles"
  ON public.user_roles FOR DELETE
  USING (public.has_role(auth.uid(), 'ceo'));

-- CEO pode ver todos os roles
CREATE POLICY "CEO can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'ceo'));

-- Políticas RLS para AREAS
-- Todos autenticados podem ver áreas
CREATE POLICY "Authenticated users can view areas"
  ON public.areas FOR SELECT
  TO authenticated
  USING (true);

-- Apenas CEO pode gerenciar áreas
CREATE POLICY "Only CEO can insert areas"
  ON public.areas FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'ceo'));

CREATE POLICY "Only CEO can update areas"
  ON public.areas FOR UPDATE
  USING (public.has_role(auth.uid(), 'ceo'));

CREATE POLICY "Only CEO can delete areas"
  ON public.areas FOR DELETE
  USING (public.has_role(auth.uid(), 'ceo'));

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_areas_updated_at
  BEFORE UPDATE ON public.areas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();