-- Espelho da view de verbas em schema public para compatibilidade com PostgREST
-- (evita dependência de schema gold estar exposto em API Settings)

CREATE OR REPLACE VIEW public.vw_pagamento_verba_pivot_mensal AS
SELECT *
FROM gold.vw_pagamento_verba_pivot_mensal;

REVOKE ALL ON TABLE public.vw_pagamento_verba_pivot_mensal FROM anon, authenticated;
GRANT SELECT ON TABLE public.vw_pagamento_verba_pivot_mensal TO service_role;
