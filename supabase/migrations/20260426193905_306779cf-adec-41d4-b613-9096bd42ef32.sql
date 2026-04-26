-- 1) Remove plaintext password columns
ALTER TABLE public.doctors DROP COLUMN IF EXISTS portal_password_plain;
ALTER TABLE public.delivery_agents DROP COLUMN IF EXISTS portal_password_plain;

-- 2) Tighten case-attachments storage policies (doctors must own the case via path)
DROP POLICY IF EXISTS "doctor read own case files" ON storage.objects;
DROP POLICY IF EXISTS "doctor upload own case files" ON storage.objects;

-- File path convention: {lab_id}/{case_id}/...
CREATE POLICY "doctor read own case files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'case-attachments'
  AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id::text = (storage.foldername(name))[2]
      AND c.doctor_id = public.current_doctor_id()
  )
);

CREATE POLICY "doctor upload own case files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'case-attachments'
  AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id::text = (storage.foldername(name))[2]
      AND c.doctor_id = public.current_doctor_id()
      AND c.lab_id::text = (storage.foldername(name))[1]
  )
);

-- 3) Restrict case-media bucket writes to lab members based on path lab_id
DROP POLICY IF EXISTS "case-media auth upload" ON storage.objects;
DROP POLICY IF EXISTS "case-media auth update" ON storage.objects;
DROP POLICY IF EXISTS "case-media auth delete" ON storage.objects;

CREATE POLICY "case-media lab members upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'case-media'
  AND public.is_lab_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "case-media lab members update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'case-media'
  AND public.is_lab_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "case-media lab members delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'case-media'
  AND public.is_lab_member(((storage.foldername(name))[1])::uuid)
);