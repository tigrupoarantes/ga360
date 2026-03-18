-- Corrige permissão de apply_payroll_staging para usuários autenticados.
-- A migration anterior só concedia EXECUTE para service_role.
-- O botão "Recalcular associações" chama supabase.rpc() do browser (role: authenticated).
-- Sem esse GRANT, a chamada falha silenciosamente com "permission denied for function".

GRANT EXECUTE ON FUNCTION public.apply_payroll_staging(INTEGER) TO authenticated;
