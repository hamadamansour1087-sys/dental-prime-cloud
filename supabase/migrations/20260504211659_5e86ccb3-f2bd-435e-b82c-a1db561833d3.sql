
-- 1. Revoke EXECUTE from anon on all SECURITY DEFINER functions using oid
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon;', r.proname, r.args);
  END LOOP;
END
$$;

-- 2. Fix current_doctor_id to enforce portal_enabled = true
CREATE OR REPLACE FUNCTION public.current_doctor_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id FROM public.doctors WHERE user_id = auth.uid() AND portal_enabled = true LIMIT 1;
$function$;

-- 3. Fix current_doctor_lab_id to enforce portal_enabled = true
CREATE OR REPLACE FUNCTION public.current_doctor_lab_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT lab_id FROM public.doctors WHERE user_id = auth.uid() AND portal_enabled = true LIMIT 1;
$function$;
