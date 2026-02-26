-- Garante chave natural para upsert de eventos de verba
CREATE UNIQUE INDEX IF NOT EXISTS ux_payroll_verba_events_natural_key
  ON public.payroll_verba_events (company_id, cpf, ano, mes, cod_evento);
