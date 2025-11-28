-- Add client field to track where materials were allocated
ALTER TABLE public.trade_inventory_movements
ADD COLUMN client_name text;

-- Drop and recreate the view to include client info
DROP VIEW IF EXISTS public.trade_inventory_balance;

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
  mov.company_id,
  COALESCE(SUM(
    CASE 
      WHEN mov.movement_type = 'entrada' THEN mov.quantity
      WHEN mov.movement_type = 'saida' THEN -mov.quantity
      ELSE mov.quantity
    END
  ), 0)::integer as current_stock,
  MAX(mov.movement_date) as last_movement
FROM trade_materials m
LEFT JOIN trade_industries i ON m.industry_id = i.id
LEFT JOIN trade_inventory_movements mov ON mov.material_id = m.id
GROUP BY m.id, m.name, m.category, m.unit, m.image_url, i.id, i.name, i.logo_url, mov.company_id;