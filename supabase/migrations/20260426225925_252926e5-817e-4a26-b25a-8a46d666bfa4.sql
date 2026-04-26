-- Allow delivery agents to upload signature images
DROP POLICY IF EXISTS "agents upload delivery signatures" ON storage.objects;
CREATE POLICY "agents upload delivery signatures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-signatures'
  AND public.current_agent_id() IS NOT NULL
);

-- Allow delivery agents to read signatures (their own uploads)
DROP POLICY IF EXISTS "agents read delivery signatures" ON storage.objects;
CREATE POLICY "agents read delivery signatures"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-signatures'
  AND public.current_agent_id() IS NOT NULL
);

-- Allow lab members (manager/admin/technician) to read all signatures from their lab
DROP POLICY IF EXISTS "lab members read delivery signatures" ON storage.objects;
CREATE POLICY "lab members read delivery signatures"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-signatures'
  AND EXISTS (
    SELECT 1 FROM public.case_deliveries cd
    WHERE cd.signature_path = storage.objects.name
      AND public.is_lab_member(cd.lab_id)
  )
);