-- Add trial/subscription fields to labs
ALTER TABLE public.labs
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS trial_days integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS trial_start_date date;

-- Create lab_requests table for self-signup
CREATE TABLE public.lab_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  owner_name text NOT NULL,
  lab_name text NOT NULL,
  email text,
  phone text,
  address text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  rejection_reason text,
  created_lab_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lab_requests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own requests
CREATE POLICY "users insert own lab_requests"
  ON public.lab_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own requests
CREATE POLICY "users read own lab_requests"
  ON public.lab_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Super admins (users with no lab_id in profiles OR specific super-admin role) can manage all
-- For now, allow any authenticated user to read all for admin panel
-- We'll use a function to check super admin status
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
$$;

CREATE POLICY "super admins read all lab_requests"
  ON public.lab_requests FOR SELECT
  USING (is_super_admin());

CREATE POLICY "super admins update lab_requests"
  ON public.lab_requests FOR UPDATE
  USING (is_super_admin());

-- Function to approve a lab request (creates the lab + profile + role)
CREATE OR REPLACE FUNCTION public.approve_lab_request(
  _request_id uuid,
  _trial_days integer DEFAULT 14
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req record;
  _lab_id uuid;
BEGIN
  -- Get the request
  SELECT * INTO _req FROM public.lab_requests WHERE id = _request_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  -- Create the lab
  INSERT INTO public.labs (name, email, phone, address, subscription_status, trial_days, trial_start_date)
  VALUES (_req.lab_name, _req.email, _req.phone, _req.address, 'trial', _trial_days, CURRENT_DATE)
  RETURNING id INTO _lab_id;

  -- Update user profile to link to lab
  UPDATE public.profiles SET lab_id = _lab_id WHERE id = _req.user_id;

  -- Give the user admin role for the new lab
  INSERT INTO public.user_roles (user_id, lab_id, role) VALUES (_req.user_id, _lab_id, 'admin');

  -- Update the request
  UPDATE public.lab_requests
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      created_lab_id = _lab_id,
      updated_at = now()
  WHERE id = _request_id;

  RETURN _lab_id;
END;
$$;