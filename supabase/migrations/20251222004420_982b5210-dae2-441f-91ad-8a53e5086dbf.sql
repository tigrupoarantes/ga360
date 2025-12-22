-- First, clean up any duplicate roles by keeping only the most powerful one per user
-- Role hierarchy: super_admin > ceo > diretor > gerente > colaborador
WITH ranked_roles AS (
  SELECT 
    id,
    user_id,
    role,
    ROW_NUMBER() OVER (
      PARTITION BY user_id 
      ORDER BY 
        CASE role 
          WHEN 'super_admin' THEN 1
          WHEN 'ceo' THEN 2
          WHEN 'diretor' THEN 3
          WHEN 'gerente' THEN 4
          WHEN 'colaborador' THEN 5
        END
    ) as rn
  FROM public.user_roles
),
roles_to_keep AS (
  SELECT id FROM ranked_roles WHERE rn = 1
)
DELETE FROM public.user_roles
WHERE id NOT IN (SELECT id FROM roles_to_keep);

-- Now add unique constraint on user_id
ALTER TABLE public.user_roles 
  ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);