-- Add report storage columns to stock_audits table
ALTER TABLE public.stock_audits
ADD COLUMN IF NOT EXISTS report_html text,
ADD COLUMN IF NOT EXISTS report_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS report_sent_to text[];