-- Create user_invites table for invitation management
CREATE TABLE public.user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company_id UUID REFERENCES public.companies(id),
  area_id UUID REFERENCES public.areas(id),
  roles TEXT[] NOT NULL DEFAULT '{"colaborador"}',
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by UUID REFERENCES auth.users(id),
  token UUID DEFAULT gen_random_uuid() UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Super admin and CEO can view all invites"
ON public.user_invites
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "Super admin and CEO can manage invites"
ON public.user_invites
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

-- Public policy to validate tokens (for registration flow)
CREATE POLICY "Anyone can validate invite tokens"
ON public.user_invites
FOR SELECT
USING (token IS NOT NULL AND status = 'pending' AND expires_at > now());

-- Create updated_at trigger
CREATE TRIGGER update_user_invites_updated_at
BEFORE UPDATE ON public.user_invites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add email_config to system_settings if not exists
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'email_config',
  '{"enabled": true, "from_name": "GA 360", "from_email": "noreply@ga360.com", "reply_to": "", "notifications": {"meeting_created": true, "meeting_reminder": true, "task_assigned": true, "invite_sent": true}}'::jsonb,
  'Configurações de envio de e-mail'
)
ON CONFLICT (key) DO NOTHING;