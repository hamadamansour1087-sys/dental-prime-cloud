CREATE OR REPLACE FUNCTION public.create_followup_case(
  _parent_case_id uuid,
  _case_type text,
  _with_new_work boolean DEFAULT false,
  _charge_mode text DEFAULT 'free'::text,
  _custom_price numeric DEFAULT NULL::numeric,
  _notes text DEFAULT NULL::text,
  _due_date date DEFAULT NULL::date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_parent RECORD;
  v_new_id uuid;
  v_prefix text;
  v_new_number text;
  v_base_number text;
  v_workflow_id uuid;
  v_start_stage uuid;
  v_target_stage uuid;
  v_price numeric;
  v_parent_items_total numeric;
  v_parent_has_items boolean;
BEGIN
  IF _case_type NOT IN ('remake', 'repair') THEN
    RAISE EXCEPTION 'Invalid case type. Must be remake or repair.';
  END IF;

  IF _charge_mode NOT IN ('free', 'paid') THEN
    RAISE EXCEPTION 'Invalid charge mode. Must be free or paid.';
  END IF;

  SELECT * INTO v_parent FROM public.cases WHERE id = _parent_case_id;
  IF v_parent.id IS NULL THEN
    RAISE EXCEPTION 'Parent case not found';
  END IF;

  IF NOT public.is_lab_member(v_parent.lab_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  v_prefix := CASE WHEN _case_type = 'remake' THEN 'R-' ELSE 'F-' END;
  v_base_number := regexp_replace(v_parent.case_number, '^(R-|F-)+', '');
  v_new_number := v_prefix || v_base_number;

  IF EXISTS (
    SELECT 1
    FROM public.cases
    WHERE lab_id = v_parent.lab_id AND case_number = v_new_number
  ) THEN
    DECLARE v_i int := 2;
    BEGIN
      WHILE EXISTS (
        SELECT 1
        FROM public.cases
        WHERE lab_id = v_parent.lab_id AND case_number = v_new_number || '/' || v_i
      ) LOOP
        v_i := v_i + 1;
      END LOOP;
      v_new_number := v_new_number || '/' || v_i;
    END;
  END IF;

  v_workflow_id := v_parent.workflow_id;
  IF v_workflow_id IS NULL THEN
    SELECT id INTO v_workflow_id
    FROM public.workflows
    WHERE lab_id = v_parent.lab_id AND is_default = true
    LIMIT 1;
  END IF;

  SELECT id INTO v_start_stage
  FROM public.workflow_stages
  WHERE workflow_id = v_workflow_id AND is_start = true
  LIMIT 1;

  v_target_stage := COALESCE(v_parent.current_stage_id, v_start_stage);

  SELECT EXISTS (
    SELECT 1 FROM public.case_items WHERE case_id = _parent_case_id
  ) INTO v_parent_has_items;

  SELECT COALESCE(SUM(COALESCE(total_price, COALESCE(unit_price, 0) * COALESCE(units, 1))), 0)
  INTO v_parent_items_total
  FROM public.case_items
  WHERE case_id = _parent_case_id;

  v_parent_items_total := COALESCE(NULLIF(v_parent_items_total, 0), COALESCE(v_parent.price, 0));

  IF _charge_mode = 'free' THEN
    v_price := 0;
  ELSIF _custom_price IS NOT NULL THEN
    v_price := _custom_price;
  ELSE
    v_price := v_parent_items_total;
  END IF;

  INSERT INTO public.cases (
    lab_id,
    case_number,
    doctor_id,
    patient_id,
    work_type_id,
    workflow_id,
    current_stage_id,
    shade,
    tooth_numbers,
    units,
    notes,
    price,
    status,
    date_received,
    due_date,
    stage_entered_at,
    created_by,
    parent_case_id,
    case_type,
    charge_mode
  ) VALUES (
    v_parent.lab_id,
    v_new_number,
    v_parent.doctor_id,
    v_parent.patient_id,
    v_parent.work_type_id,
    v_workflow_id,
    v_target_stage,
    v_parent.shade,
    v_parent.tooth_numbers,
    COALESCE(v_parent.units, 1),
    COALESCE(_notes, CASE WHEN _case_type = 'remake' THEN 'إعادة للحالة ' ELSE 'تصليح للحالة ' END || v_parent.case_number),
    v_price,
    'active'::public.case_status,
    CURRENT_DATE,
    _due_date,
    now(),
    auth.uid(),
    _parent_case_id,
    _case_type,
    _charge_mode
  ) RETURNING id INTO v_new_id;

  IF v_parent_has_items THEN
    INSERT INTO public.case_items (
      case_id,
      lab_id,
      notes,
      position,
      shade,
      tooth_numbers,
      total_price,
      unit_price,
      units,
      work_type_id
    )
    SELECT
      v_new_id,
      v_parent.lab_id,
      ci.notes,
      ci.position,
      ci.shade,
      ci.tooth_numbers,
      CASE WHEN _charge_mode = 'free' THEN 0 ELSE ci.total_price END,
      CASE WHEN _charge_mode = 'free' THEN 0 ELSE ci.unit_price END,
      COALESCE(ci.units, 1),
      ci.work_type_id
    FROM public.case_items ci
    WHERE ci.case_id = _parent_case_id
    ORDER BY ci.position;
  ELSIF v_parent.work_type_id IS NOT NULL THEN
    INSERT INTO public.case_items (
      case_id,
      lab_id,
      notes,
      position,
      shade,
      tooth_numbers,
      total_price,
      unit_price,
      units,
      work_type_id
    ) VALUES (
      v_new_id,
      v_parent.lab_id,
      v_parent.notes,
      0,
      v_parent.shade,
      v_parent.tooth_numbers,
      CASE WHEN _charge_mode = 'free' THEN 0 ELSE v_price END,
      CASE WHEN _charge_mode = 'free' THEN 0 ELSE ROUND(v_price / GREATEST(COALESCE(v_parent.units, 1), 1), 2) END,
      GREATEST(COALESCE(v_parent.units, 1), 1),
      v_parent.work_type_id
    );
  END IF;

  IF v_target_stage IS NOT NULL THEN
    INSERT INTO public.case_stage_history (case_id, lab_id, stage_id, entered_by, entered_at)
    VALUES (v_new_id, v_parent.lab_id, v_target_stage, auth.uid(), now());
  END IF;

  INSERT INTO public.audit_log (lab_id, user_id, entity_type, entity_id, action, details)
  VALUES (
    v_parent.lab_id,
    auth.uid(),
    'case',
    v_new_id,
    CASE WHEN _case_type = 'remake' THEN 'remake_created' ELSE 'repair_created' END,
    jsonb_build_object(
      'parent_case_id', _parent_case_id,
      'parent_case_number', v_parent.case_number,
      'with_new_work', _with_new_work,
      'charge_mode', _charge_mode,
      'price', v_price
    )
  );

  RETURN v_new_id;
END;
$function$;

INSERT INTO public.case_items (
  case_id,
  lab_id,
  notes,
  position,
  shade,
  tooth_numbers,
  total_price,
  unit_price,
  units,
  work_type_id
)
SELECT
  c.id,
  c.lab_id,
  c.notes,
  0,
  c.shade,
  c.tooth_numbers,
  COALESCE(c.price, 0),
  CASE
    WHEN GREATEST(COALESCE(c.units, 1), 1) > 0 THEN ROUND(COALESCE(c.price, 0) / GREATEST(COALESCE(c.units, 1), 1), 2)
    ELSE COALESCE(c.price, 0)
  END,
  GREATEST(COALESCE(c.units, 1), 1),
  c.work_type_id
FROM public.cases c
WHERE c.work_type_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.case_items ci WHERE ci.case_id = c.id
  );