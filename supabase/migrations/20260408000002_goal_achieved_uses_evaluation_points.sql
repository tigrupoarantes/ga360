-- Migration: Gamificacao — pontos por meta usam evaluation_points (PE 2026)
--
-- Antes desta migration: responsavel ganhava 50 pts × weight, criador 20 pts × weight (fixos).
-- Depois desta migration: usa evaluation_points × weight quando disponivel.
--   - Responsavel: ROUND(evaluation_points * gamification_weight)
--   - Criador (se diferente): ROUND(evaluation_points * 0.4 * gamification_weight)
--   - Fallback (evaluation_points NULL ou <= 0): mantem 50/20 fixos para metas legacy
--
-- Justificativa: o CSV PE 2026 tem "PONTOS POR AVALIACAO" variando de 0,25 a 70.
-- Sem este ajuste, todas as ~520 metas dariam o mesmo bonus e o ranking ficaria sem sentido.

CREATE OR REPLACE FUNCTION public.trigger_points_on_goal_achieved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_weight             NUMERIC := COALESCE(NEW.gamification_weight, 1);
  v_eval               NUMERIC := NEW.evaluation_points;
  v_responsible_points INTEGER;
  v_creator_points     INTEGER;
  v_weight_label       TEXT := trim(to_char(v_weight, 'FM999999990.##'));
  v_basis_label        TEXT;
BEGIN
  -- Disparo: meta atingida (current_value >= target_value) na transicao
  IF NEW.target_value IS NOT NULL
     AND NEW.current_value >= NEW.target_value
     AND (OLD.current_value IS NULL OR OLD.current_value < OLD.target_value) THEN

    -- Calculo: usa evaluation_points do CSV se existir; senao fallback 50/20
    IF v_eval IS NOT NULL AND v_eval > 0 THEN
      v_responsible_points := ROUND(v_eval * v_weight)::INTEGER;
      v_creator_points     := ROUND(v_eval * 0.4 * v_weight)::INTEGER;
      v_basis_label        := 'Pontos: ' || trim(to_char(v_eval, 'FM999999990.##'))
                              || ' x peso ' || v_weight_label;
    ELSE
      v_responsible_points := ROUND(50 * v_weight)::INTEGER;
      v_creator_points     := ROUND(20 * v_weight)::INTEGER;
      v_basis_label        := 'Peso ' || v_weight_label || ' (fallback legacy)';
    END IF;

    -- Pontos para o responsavel
    IF NEW.responsible_id IS NOT NULL AND v_responsible_points > 0 THEN
      PERFORM public.add_user_points(
        NEW.responsible_id,
        v_responsible_points,
        'goal_achieved',
        'Meta alcançada: ' || NEW.title || ' - ' || v_basis_label,
        NEW.id,
        'goal'
      );
    END IF;

    -- Pontos para o criador (se diferente do responsavel)
    IF NEW.created_by IS NOT NULL
       AND NEW.created_by != NEW.responsible_id
       AND v_creator_points > 0 THEN
      PERFORM public.add_user_points(
        NEW.created_by,
        v_creator_points,
        'goal_achieved_team',
        'Meta da equipe alcançada: ' || NEW.title || ' - ' || v_basis_label,
        NEW.id,
        'goal'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger ja existe (criado em 20260325140000) e aponta para a mesma funcao;
-- so substituimos o corpo via CREATE OR REPLACE FUNCTION acima.
