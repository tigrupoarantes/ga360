# GA360 — Precificação e Valor de Mercado

**Data de referência:** 2026-03-06
**Autor:** William Cintra (solo developer + IA)
**Status:** Documento de consulta interna

---

## 1. Escopo do Projeto Entregue

Sistema completo construído por um único desenvolvedor com assistência de IA:

| Componente | Descrição |
|------------|-----------|
| **React SPA** | Frontend multi-tenant com 40+ páginas e componentes |
| **Auth + 2FA** | Login, segundo fator via WhatsApp/email, roles, multi-tenant |
| **39 Edge Functions** | Backend serverless em Deno/TypeScript no Supabase |
| **40+ Migrations** | Schema PostgreSQL com RLS, triggers, funções PL/pgSQL |
| **Módulos de negócio** | Metas, Reuniões, KPIs, Comercial, Logística, RH/PJ, Governança |
| **Cockpit Analytics** | Heatmap geoespacial, attack list, dashboards de campo |
| **Public API v1** | 12 endpoints REST, OpenAPI spec, webhook HMAC-SHA256, auth própria |
| **MCP Server** | 11 tools para integração com Claude Desktop / Claude API |
| **DAB Proxy** | Proxy reverso para sistema de distribuição com proteção SSRF |
| **Admin UI** | Gerenciamento de API Keys, configurações de integrações |
| **Auditoria de Segurança** | 29 findings (5 críticos, 9 altos, 8 médios, 7 baixos) remediados |
| **Integrações** | n8n (webhooks), Claude Desktop (MCP), Twilio, OpenAI, Gemini, ElevenLabs |

---

## 2. Equivalência de Mão de Obra Humana

### Time necessário para reproduzir o projeto

| Papel | Senioridade | Qtde |
|-------|-------------|------|
| Tech Lead / Arquiteto Full-Stack | Sênior | 1 |
| Frontend Developer | Pleno/Sênior | 2 |
| Backend / Edge Functions | Sênior | 1 |
| Data / Analytics | Pleno | 1 |
| DevOps / Infraestrutura | Pleno | 0,5 |
| Security Engineer | Sênior | 0,5 |
| UX / UI Designer | Pleno | 1 |
| Product Manager | Sênior | 0,5 |
| QA Engineer | Pleno | 1 |
| **Total** | | **~8,5 headcounts** |

### Cronograma equivalente (equipe completa)

| Fase | Escopo | Duração |
|------|--------|---------|
| 0 | Setup & Arquitetura | 2 semanas |
| 1 | Auth & Multi-tenant | 4 semanas |
| 2 | Módulos principais | 8 semanas |
| 3 | Cockpit Analytics | 6 semanas |
| 4 | Admin & Settings | 4 semanas |
| 5 | Edge Functions | 4 semanas |
| 6 | Public API v1 | 3 semanas |
| 7 | MCP Server | 2 semanas |
| 8 | DAB Proxy | 2 semanas |
| 9 | Auditoria de Segurança | 4 semanas |
| 10 | Integrações externas | 2 semanas |
| 11 | QA, polish, docs | 3 semanas |
| **Total** | | **~44 semanas (11 meses)** |

MVP funcional (fases 0–3): ~5 meses com equipe completa.

---

## 3. Custo de Mercado — Mão de Obra Humana

### Mercado brasileiro (CLT)

| Papel | Salário/mês | 12 meses |
|-------|-------------|----------|
| Tech Lead Sênior | R$ 22.000 | R$ 264.000 |
| Frontend Dev Pleno (×2) | R$ 12.500 | R$ 300.000 |
| Backend Sênior | R$ 15.000 | R$ 180.000 |
| Data Dev Pleno | R$ 12.000 | R$ 144.000 |
| DevOps Pleno (×0,5) | R$ 15.000 | R$ 90.000 |
| Security Engineer (×0,5) | R$ 20.000 | R$ 120.000 |
| UX/UI Designer | R$ 10.000 | R$ 120.000 |
| Product Manager (×0,5) | R$ 15.000 | R$ 90.000 |
| QA Engineer | R$ 10.000 | R$ 120.000 |
| **Subtotal salários** | | **R$ 1.428.000** |
| **+ 70% encargos CLT** (FGTS, férias, 13º, INSS, benefícios) | | **R$ 999.600** |
| **Total CLT** | | **R$ 2.427.600** |

**No modelo PJ** (sem encargos, com markup de mercado ~30%): ~R$ 1.856.400

### Infraestrutura recorrente

| Serviço | Custo/mês |
|---------|-----------|
| Supabase Pro + compute | ~R$ 650 |
| Vercel Pro | ~R$ 104 |
| Twilio WhatsApp | ~R$ 400–800 |
| OpenAI API | ~R$ 200–500 |
| ElevenLabs | ~R$ 515 |
| n8n Cloud | ~R$ 260 |
| Evolution API (VPS self-hosted) | ~R$ 150 |
| **Total infra/mês** | **~R$ 2.300–3.000** |

**12 meses de desenvolvimento + produção: ~R$ 28.000–36.000**

### Licenciamento

Todo o stack utiliza licenças **MIT / Apache 2.0 / open-source gratuitas**.
Custo de licenciamento: **R$ 0**

---

## 4. Valor de Mercado (Software House)

Uma software house brasileira de médio/alto padrão cobra R$ 450–700/hora para projetos desse nível técnico.

```
~7 devs × 44 semanas × 40h/semana = 12.320 horas
12.320h × R$ 575 (média) = R$ 7.084.000
```

| Referência | Valor |
|------------|-------|
| Valor mínimo de mercado | R$ 5.500.000 |
| Valor médio de mercado | R$ 7.000.000 |
| Valor máximo de mercado | R$ 9.000.000 |
| Mercado internacional (US$130/h) | US$ 1.600.000 |

---

## 5. Quanto Cobrar Como Desenvolvedor Solo com IA

### O princípio central

> **Você entrega valor de mercado de R$ 5,5M–9M.**
> O cliente compra o software funcionando, não as horas gastas.
> A IA eliminou o custo de produção — não reduziu o valor do entregável.

### Comparação de margens

| Modelo | Custo de produção | Preço de venda | Margem |
|--------|------------------|----------------|--------|
| Software house (equipe humana) | ~R$ 2.500.000 | ~R$ 7.000.000 | ~64% |
| Solo developer com IA | ~R$ 15.000 (infra + tempo) | R$ 300.000–600.000 | ~97% |

### Modelos de precificação recomendados

#### Opção A — Projeto Fechado (entrega turnkey)

| Escopo | Faixa de preço |
|--------|---------------|
| MVP (Auth + Metas + Reuniões + KPIs + Admin) | R$ 120.000 – R$ 200.000 |
| Sistema completo atual | R$ 350.000 – R$ 600.000 |
| + Customização pesada por vertical de negócio | R$ 500.000 – R$ 1.000.000 |

**Piso recomendado:** R$ 200.000 — abaixo disso é trabalho técnico sênior doado.

#### Opção B — SaaS Licenciado (modelo produto)

Em vez de vender o código, cobrar pelo acesso:

| Tier | Preço/mês | Características |
|------|-----------|-----------------|
| Startup | R$ 2.500 | até 50 usuários, 1 tenant |
| Empresa | R$ 8.000 | multi-tenant, API pública |
| Enterprise | R$ 20.000+ | MCP, integrações custom, SLA 99,9% |

**Com 10 clientes no tier Empresa:** R$ 80.000/mês recorrente.

#### Opção C — Consultoria + Implementação

Como tech lead autônomo entregando projetos semelhantes para outros clientes:

```
R$ 800 – R$ 1.500/hora
```

Projetos de 3–6 meses: R$ 150.000 – R$ 400.000 por projeto.

---

## 6. Diferenciais Técnicos que Justificam o Preço

Competências raras no mercado que este projeto demonstra:

| Competência | Raridade no mercado |
|-------------|---------------------|
| Multi-tenant real com RLS no PostgreSQL | Alta — a maioria nunca implementou |
| Deploy de edge functions sem CLI em ambiente restrito | Muito alta — problema não documentado |
| Arquitetura MCP para integração com IA | Muito alta — tecnologia 2024/2025 |
| Auditoria de segurança com 29 findings documentados | Alta — requer security engineering |
| Public API com OpenAPI spec, webhooks HMAC, SDK-ready | Alta — arquitetura de produto |
| Cockpit geoespacial com heatmap de atacabilidade | Alta — analytics avançado |

---

## 7. Histórico de Entrega

| Item | Status |
|------|--------|
| Sistema GA360 completo em produção | Vercel — `ga360.vercel.app` |
| Migrações aplicadas em produção | Supabase — projeto `zveqhxaiwghexfobjaek` |
| Edge function `public-api` v7 | ACTIVE |
| Edge function `mcp-server` v2 | ACTIVE |
| OpenAPI spec servida dinamicamente | `GET /functions/v1/public-api/v1/openapi.json` |
| Auditoria de segurança completa | `docs/` — plano de remediação |

---

## 8. Notas para Negociação

1. **Nunca negocie por hora** para projetos desse porte — negocie por valor entregue.
2. **Inclua manutenção** como serviço recorrente: R$ 5.000–15.000/mês dependendo do SLA.
3. **Propriedade intelectual** deve ser transferida contratualmente — isso aumenta o preço.
4. **Exclusividade de vertical** (ex.: só para distribuidoras de alimentos) pode dobrar o valor.
5. **A IA é sua vantagem competitiva** — não é motivo para cobrar menos, é motivo para ter maior margem.

---

*Documento gerado em 2026-03-06. Valores em BRL. Cotação de referência: USD 1 = BRL 5,20.*
