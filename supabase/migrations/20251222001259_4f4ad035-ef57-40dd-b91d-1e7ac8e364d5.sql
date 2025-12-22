-- Criar tabela de logs de auditoria
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  target_user_id uuid,
  action_type text NOT NULL,
  details jsonb,
  ip_address text,
  created_at timestamp with time zone DEFAULT now()
);

-- Índices para consultas frequentes
CREATE INDEX idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_target_user_id ON public.audit_logs(target_user_id);
CREATE INDEX idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política: Super admin e CEO podem visualizar logs
CREATE POLICY "Super admin and CEO can view audit logs"
ON public.audit_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'ceo'::app_role)
);

-- Política: Usuários autenticados podem inserir logs (para suas próprias ações)
CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (auth.uid() = actor_id);