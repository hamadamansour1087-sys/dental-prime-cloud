-- 1) case-media: make private + scoped read
UPDATE storage.buckets SET public = false WHERE id = 'case-media';

DROP POLICY IF EXISTS "case-media public read" ON storage.objects;
DROP POLICY IF EXISTS "Public read case-media" ON storage.objects;
DROP POLICY IF EXISTS "case-media auth read" ON storage.objects;
DROP POLICY IF EXISTS "case-media scoped read" ON storage.objects;

CREATE POLICY "case-media scoped read"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'case-media'
  AND (
    public.is_lab_member(((storage.foldername(name))[1])::uuid)
    OR EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id::text = (storage.foldername(name))[2]
        AND c.doctor_id = public.current_doctor_id()
    )
  )
);

-- 2) lab-logos: restrict writes to admins of the lab encoded in path
DROP POLICY IF EXISTS "Lab members upload logo" ON storage.objects;
DROP POLICY IF EXISTS "Lab members update logo" ON storage.objects;
DROP POLICY IF EXISTS "Lab members delete logo" ON storage.objects;
DROP POLICY IF EXISTS "lab-logos admin upload" ON storage.objects;
DROP POLICY IF EXISTS "lab-logos admin update" ON storage.objects;
DROP POLICY IF EXISTS "lab-logos admin delete" ON storage.objects;

CREATE POLICY "lab-logos admin upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'lab-logos'
  AND public.is_lab_admin(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "lab-logos admin update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'lab-logos'
  AND public.is_lab_admin(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "lab-logos admin delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'lab-logos'
  AND public.is_lab_admin(((storage.foldername(name))[1])::uuid)
);

-- 3) realtime.messages RLS: scope topic subscriptions
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "realtime scoped subscribe" ON realtime.messages;

-- Topic convention used in app: 'lab:{lab_id}', 'doctor:{doctor_id}', 'agent:{agent_id}',
-- or postgres_changes channels named 'cases', 'portal_messages' (default channel).
-- Allow only when topic encodes a lab the user belongs to, or doctor/agent identity matches.
CREATE POLICY "realtime scoped subscribe"
ON realtime.messages FOR SELECT
TO authenticated
USING (
  -- lab-scoped topic e.g. "lab:<uuid>"
  (
    realtime.topic() LIKE 'lab:%'
    AND public.is_lab_member((substring(realtime.topic() FROM 5))::uuid)
  )
  OR (
    realtime.topic() LIKE 'doctor:%'
    AND (substring(realtime.topic() FROM 8))::uuid = public.current_doctor_id()
  )
  OR (
    realtime.topic() LIKE 'agent:%'
    AND (substring(realtime.topic() FROM 7))::uuid = public.current_agent_id()
  )
);
