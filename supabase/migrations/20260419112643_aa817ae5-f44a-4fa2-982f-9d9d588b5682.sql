CREATE OR REPLACE FUNCTION public.generate_case_number(_lab_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_yy TEXT := to_char(now(), 'YY');
  v_mm TEXT := to_char(now(), 'MM');
  v_prefix TEXT := v_yy || '-' || v_mm || '-';
  v_max INTEGER;
  v_next INTEGER;
BEGIN
  -- Find the highest sequence number for this lab in the current month
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(case_number, '^' || v_prefix, ''), '')::INTEGER
  ), 0)
  INTO v_max
  FROM public.cases
  WHERE lab_id = _lab_id
    AND case_number LIKE v_prefix || '%'
    AND case_number ~ ('^' || v_prefix || '[0-9]+$');

  v_next := v_max + 1;
  RETURN v_prefix || LPAD(v_next::text, 4, '0');
END;
$function$;