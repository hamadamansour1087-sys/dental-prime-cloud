-- Drop existing permissive policies
DROP POLICY IF EXISTS "doctor inserts own portal messages" ON public.portal_messages;
DROP POLICY IF EXISTS "doctor updates own portal messages" ON public.portal_messages;
DROP POLICY IF EXISTS "lab members insert portal messages" ON public.portal_messages;
DROP POLICY IF EXISTS "lab members update portal messages" ON public.portal_messages;

-- Doctor insert: must be own thread + sender_type forced to 'doctor'
CREATE POLICY "doctor inserts own portal messages"
ON public.portal_messages
FOR INSERT
WITH CHECK (
  doctor_id = public.current_doctor_id()
  AND lab_id = public.current_doctor_lab_id()
  AND sender_type = 'doctor'
  AND sender_user_id = auth.uid()
);

-- Doctor update: only own thread AND only their own messages (not lab's),
-- and cannot change identity/content fields — WITH CHECK preserves immutables.
CREATE POLICY "doctor updates own messages"
ON public.portal_messages
FOR UPDATE
USING (
  doctor_id = public.current_doctor_id()
  AND sender_type = 'doctor'
)
WITH CHECK (
  doctor_id = public.current_doctor_id()
  AND sender_type = 'doctor'
);

-- Doctor mark-as-read on lab messages: allow updating only the read_by_doctor flag
-- by restricting the row scope; column-level enforcement is handled by app + trigger below.
CREATE POLICY "doctor marks lab messages read"
ON public.portal_messages
FOR UPDATE
USING (
  doctor_id = public.current_doctor_id()
  AND sender_type = 'lab'
)
WITH CHECK (
  doctor_id = public.current_doctor_id()
  AND sender_type = 'lab'
);

-- Trigger: prevent doctors from mutating anything other than read_by_doctor on lab messages,
-- and prevent labs from mutating anything other than read_by_lab on doctor messages.
CREATE OR REPLACE FUNCTION public.portal_messages_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_doctor boolean := (OLD.doctor_id = public.current_doctor_id());
  v_is_lab boolean := public.is_lab_member(OLD.lab_id);
BEGIN
  -- Immutable identity/content fields for everyone
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.lab_id IS DISTINCT FROM OLD.lab_id
     OR NEW.doctor_id IS DISTINCT FROM OLD.doctor_id
     OR NEW.case_id IS DISTINCT FROM OLD.case_id
     OR NEW.sender_type IS DISTINCT FROM OLD.sender_type
     OR NEW.sender_user_id IS DISTINCT FROM OLD.sender_user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Cannot modify immutable message fields';
  END IF;

  -- Doctor updating a lab-sent message: only read_by_doctor may change
  IF v_is_doctor AND OLD.sender_type = 'lab' THEN
    IF NEW.body IS DISTINCT FROM OLD.body
       OR NEW.attachment_path IS DISTINCT FROM OLD.attachment_path
       OR NEW.attachment_name IS DISTINCT FROM OLD.attachment_name
       OR NEW.attachment_mime IS DISTINCT FROM OLD.attachment_mime
       OR NEW.read_by_lab IS DISTINCT FROM OLD.read_by_lab THEN
      RAISE EXCEPTION 'Doctors may only mark lab messages as read';
    END IF;
  END IF;

  -- Lab updating a doctor-sent message: only read_by_lab may change
  IF v_is_lab AND NOT v_is_doctor AND OLD.sender_type = 'doctor' THEN
    IF NEW.body IS DISTINCT FROM OLD.body
       OR NEW.attachment_path IS DISTINCT FROM OLD.attachment_path
       OR NEW.attachment_name IS DISTINCT FROM OLD.attachment_name
       OR NEW.attachment_mime IS DISTINCT FROM OLD.attachment_mime
       OR NEW.read_by_doctor IS DISTINCT FROM OLD.read_by_doctor THEN
      RAISE EXCEPTION 'Lab may only mark doctor messages as read';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_portal_messages_guard_update ON public.portal_messages;
CREATE TRIGGER trg_portal_messages_guard_update
BEFORE UPDATE ON public.portal_messages
FOR EACH ROW EXECUTE FUNCTION public.portal_messages_guard_update();

-- Lab insert: must be lab member, sender forced to 'lab', sender_user_id = auth.uid()
CREATE POLICY "lab members insert portal messages"
ON public.portal_messages
FOR INSERT
WITH CHECK (
  public.is_lab_member(lab_id)
  AND sender_type = 'lab'
  AND sender_user_id = auth.uid()
);

-- Lab update: lab members only on their lab's threads (column restrictions enforced by trigger)
CREATE POLICY "lab members update portal messages"
ON public.portal_messages
FOR UPDATE
USING (public.is_lab_member(lab_id))
WITH CHECK (public.is_lab_member(lab_id));