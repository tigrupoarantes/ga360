-- ============================================================================
-- GA 360 - STORAGE BUCKETS E POLÍTICAS
-- Execute após o schema-completo.sql e rls-policies.sql
-- ============================================================================

-- ============================================================================
-- 1. BUCKET: AVATARS (Público)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
);

-- Políticas para avatars
CREATE POLICY "Users can upload own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Avatars are publicly accessible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- ============================================================================
-- 2. BUCKET: EC-EVIDENCES (Privado)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ec-evidences',
  'ec-evidences',
  false,
  52428800, -- 50MB limit
  ARRAY[
    'application/pdf', 
    'image/jpeg', 
    'image/png', 
    'image/gif', 
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
    'application/vnd.ms-excel', 
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
);

-- Políticas para ec-evidences
CREATE POLICY "Authenticated users can view ec-evidences"
ON storage.objects FOR SELECT
USING (bucket_id = 'ec-evidences' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload ec-evidences"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ec-evidences' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own ec-evidences"
ON storage.objects FOR DELETE
USING (bucket_id = 'ec-evidences' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================================
-- 3. BUCKET: STOCK-AUDIT-FILES (Privado)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('stock-audit-files', 'stock-audit-files', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas para stock-audit-files
CREATE POLICY "Authenticated users can upload stock audit files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'stock-audit-files' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can view stock audit files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'stock-audit-files' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can update stock audit files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'stock-audit-files' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Super admin and CEO can delete stock audit files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'stock-audit-files' AND
  (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'ceo'::app_role))
);

-- ============================================================================
-- FIM DOS STORAGE BUCKETS
-- ============================================================================
