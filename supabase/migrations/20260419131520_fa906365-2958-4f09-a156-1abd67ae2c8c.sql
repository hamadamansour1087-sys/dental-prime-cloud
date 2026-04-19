-- Add governorate and opening_balance to doctors
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS governorate TEXT,
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC NOT NULL DEFAULT 0;

-- Create doctor_clinics table (a doctor can work in multiple clinics)
CREATE TABLE IF NOT EXISTS public.doctor_clinics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doctor_clinics_doctor ON public.doctor_clinics(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_clinics_lab ON public.doctor_clinics(lab_id);

ALTER TABLE public.doctor_clinics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lab members read doctor_clinics"
  ON public.doctor_clinics FOR SELECT
  USING (public.is_lab_member(lab_id));

CREATE POLICY "lab members insert doctor_clinics"
  ON public.doctor_clinics FOR INSERT
  WITH CHECK (public.is_lab_member(lab_id));

CREATE POLICY "lab members update doctor_clinics"
  ON public.doctor_clinics FOR UPDATE
  USING (public.is_lab_member(lab_id));

CREATE POLICY "managers delete doctor_clinics"
  ON public.doctor_clinics FOR DELETE
  USING (public.is_lab_manager_or_admin(lab_id));

CREATE TRIGGER trg_doctor_clinics_updated_at
  BEFORE UPDATE ON public.doctor_clinics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();