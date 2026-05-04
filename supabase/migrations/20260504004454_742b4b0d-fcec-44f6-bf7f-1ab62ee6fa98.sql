-- Create super_admins table
CREATE TABLE public.super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Only super admins can read this table
CREATE POLICY "super admins read own"
  ON public.super_admins FOR SELECT
  USING (user_id = auth.uid());

-- Update is_super_admin to check the new table
CREATE OR REPLACE FUNCTION public.is_super_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins
    WHERE user_id = auth.uid()
  )
$$;

-- Allow super admins to read ALL labs (for the admin panel)
CREATE POLICY "super admins read all labs"
  ON public.labs FOR SELECT
  USING (public.is_super_admin());

-- Allow super admins to update ALL labs (activate/deactivate)
CREATE POLICY "super admins update all labs"
  ON public.labs FOR UPDATE
  USING (public.is_super_admin());