-- Store generated portal password (visible to lab admins only via RLS) and ensure phone uniqueness per lab
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS portal_password_plain TEXT;

-- Unique phone per lab (only when phone is set), to support phone-based portal login
CREATE UNIQUE INDEX IF NOT EXISTS doctors_lab_phone_unique
  ON public.doctors (lab_id, phone)
  WHERE phone IS NOT NULL;