CREATE OR REPLACE FUNCTION public.is_lab_member(_lab_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur
      ON ur.user_id = p.id
     AND ur.lab_id = p.lab_id
    WHERE p.id = auth.uid()
      AND p.lab_id = _lab_id
      AND p.is_active = true
      AND ur.role IN ('admin', 'manager', 'technician')
  );
$function$;

CREATE OR REPLACE FUNCTION public.current_lab_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.lab_id
  FROM public.profiles p
  JOIN public.user_roles ur
    ON ur.user_id = p.id
   AND ur.lab_id = p.lab_id
  WHERE p.id = auth.uid()
    AND p.is_active = true
    AND ur.role IN ('admin', 'manager', 'technician')
  LIMIT 1;
$function$;