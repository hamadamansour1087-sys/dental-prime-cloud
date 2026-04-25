-- Portal messaging: thread per case OR general doctor<->lab thread
CREATE TABLE public.portal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE, -- NULL = general thread
  sender_type TEXT NOT NULL CHECK (sender_type IN ('doctor', 'lab')),
  sender_user_id UUID,
  body TEXT,
  attachment_path TEXT,
  attachment_name TEXT,
  attachment_mime TEXT,
  read_by_lab BOOLEAN NOT NULL DEFAULT false,
  read_by_doctor BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_portal_messages_doctor ON public.portal_messages(doctor_id, created_at DESC);
CREATE INDEX idx_portal_messages_case ON public.portal_messages(case_id, created_at DESC) WHERE case_id IS NOT NULL;
CREATE INDEX idx_portal_messages_lab_unread ON public.portal_messages(lab_id) WHERE read_by_lab = false;

ALTER TABLE public.portal_messages ENABLE ROW LEVEL SECURITY;

-- Lab members: read/insert/update for their lab
CREATE POLICY "lab members read portal messages"
  ON public.portal_messages FOR SELECT
  USING (public.is_lab_member(lab_id));

CREATE POLICY "lab members insert portal messages"
  ON public.portal_messages FOR INSERT
  WITH CHECK (public.is_lab_member(lab_id) AND sender_type = 'lab');

CREATE POLICY "lab members update portal messages"
  ON public.portal_messages FOR UPDATE
  USING (public.is_lab_member(lab_id));

-- Doctor: read own messages
CREATE POLICY "doctor reads own portal messages"
  ON public.portal_messages FOR SELECT
  USING (doctor_id = public.current_doctor_id());

CREATE POLICY "doctor inserts own portal messages"
  ON public.portal_messages FOR INSERT
  WITH CHECK (
    doctor_id = public.current_doctor_id()
    AND lab_id = public.current_doctor_lab_id()
    AND sender_type = 'doctor'
  );

CREATE POLICY "doctor updates own portal messages"
  ON public.portal_messages FOR UPDATE
  USING (doctor_id = public.current_doctor_id());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_messages;
ALTER TABLE public.portal_messages REPLICA IDENTITY FULL;

-- Storage bucket for chat attachments (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('portal-chat', 'portal-chat', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: path prefix is "{lab_id}/{doctor_id}/..."
CREATE POLICY "lab members read portal-chat"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'portal-chat'
    AND public.is_lab_member((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "lab members upload portal-chat"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'portal-chat'
    AND public.is_lab_member((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "doctor read own portal-chat"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'portal-chat'
    AND (storage.foldername(name))[2]::uuid = public.current_doctor_id()
  );

CREATE POLICY "doctor upload own portal-chat"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'portal-chat'
    AND (storage.foldername(name))[1]::uuid = public.current_doctor_lab_id()
    AND (storage.foldername(name))[2]::uuid = public.current_doctor_id()
  );

-- Realtime for cases too (for lab notifications on new portal cases)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'cases'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cases;
  END IF;
END $$;