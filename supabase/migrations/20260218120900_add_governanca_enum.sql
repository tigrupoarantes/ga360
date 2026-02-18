-- Add 'governanca' to system_module enum
-- Separate migration to avoid 55P04: unsafe use of new value "governanca" of enum type system_module
-- New enum values must be committed before they can be used in the same transaction.

ALTER TYPE public.system_module ADD VALUE IF NOT EXISTS 'governanca';
