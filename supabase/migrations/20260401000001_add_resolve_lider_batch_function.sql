-- ============================================================
-- Função: resolve_lider_direto_batch
-- Objetivo: resolver lider_direto_id (UUID FK) a partir de cpf_lider em um único
-- UPDATE batch, substituindo N queries individuais durante a sync.
-- Retorna o número de registros atualizados.
-- ============================================================

CREATE OR REPLACE FUNCTION public.resolve_lider_direto_batch(
  p_source_system TEXT DEFAULT 'dab_api'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE external_employees ee
  SET lider_direto_id = l.id
  FROM external_employees l
  WHERE l.cpf = ee.cpf_lider
    AND l.source_system = p_source_system
    AND ee.source_system = p_source_system
    AND ee.cpf_lider IS NOT NULL
    AND (
      ee.lider_direto_id IS NULL
      OR ee.lider_direto_id IS DISTINCT FROM l.id
    );

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Comentário descritivo
COMMENT ON FUNCTION public.resolve_lider_direto_batch(TEXT) IS
  'Resolve lider_direto_id (UUID FK) a partir do cpf_lider já armazenado no registro. '
  'Chamada ao final de cada sync para garantir consistência sem N queries individuais.';
