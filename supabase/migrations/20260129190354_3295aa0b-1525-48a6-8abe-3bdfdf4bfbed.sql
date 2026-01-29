-- Add is_auditable column to companies table
ALTER TABLE companies 
ADD COLUMN is_auditable BOOLEAN DEFAULT false;