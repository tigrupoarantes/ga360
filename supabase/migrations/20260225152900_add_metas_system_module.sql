-- ============================================================
-- PRE-F1 — Adiciona módulo 'metas' ao enum system_module
-- Necessário em migration separada para evitar erro 55P04
-- ============================================================

ALTER TYPE public.system_module ADD VALUE IF NOT EXISTS 'metas';
