-- Adicionar coluna de centro de custo na tabela areas
ALTER TABLE areas 
ADD COLUMN cost_center text;

-- Índice para consultas rápidas por centro de custo
CREATE INDEX idx_areas_cost_center ON areas(cost_center) 
WHERE cost_center IS NOT NULL;

-- Comentário para documentação
COMMENT ON COLUMN areas.cost_center IS 
  'Código do centro de custo conforme ERP';