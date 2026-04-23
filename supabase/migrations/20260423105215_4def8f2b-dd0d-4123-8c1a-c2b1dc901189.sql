ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'doctor';
ALTER TYPE public.case_status ADD VALUE IF NOT EXISTS 'pending_approval';

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS portal_enabled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_doctors_user_id ON public.doctors(user_id);