-- Drop and recreate the view with explicit security_invoker option
DROP VIEW IF EXISTS public.trade_inventory_balance;

-- Recreate with security_invoker = true (PostgreSQL 15+)
CREATE VIEW public.trade_inventory_balance 
WITH (security_invoker = true)
AS
SELECT 
  m.id as material_id,
  m.name as material_name,
  m.category,
  m.unit,
  m.image_url as material_image,
  i.id as industry_id,
  i.name as industry_name,
  i.logo_url as industry_logo,
  COALESCE(SUM(mov.quantity), 0)::integer as current_stock,
  MAX(mov.movement_date) as last_movement,
  mov.company_id
FROM public.trade_materials m
LEFT JOIN public.trade_industries i ON m.industry_id = i.id
LEFT JOIN public.trade_inventory_movements mov ON mov.material_id = m.id
WHERE m.is_active = true
GROUP BY m.id, m.name, m.category, m.unit, m.image_url, i.id, i.name, i.logo_url, mov.company_id;

-- Grant access to authenticated users
GRANT SELECT ON public.trade_inventory_balance TO authenticated;