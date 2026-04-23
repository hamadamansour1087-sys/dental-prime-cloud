-- Add follow-up case fields
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS parent_case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS case_type text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS charge_mode text NOT NULL DEFAULT 'paid';

-- Add check constraints
ALTER TABLE public.cases DROP CONSTRAINT IF EXISTS cases_case_type_check;
ALTER TABLE public.cases ADD CONSTRAINT cases_case_type_check
  CHECK (case_type IN ('new', 'remake', 'repair'));

ALTER TABLE public.cases DROP CONSTRAINT IF EXISTS cases_charge_mode_check;
ALTER TABLE public.cases ADD CONSTRAINT cases_charge_mode_check
  CHECK (charge_mode IN ('paid', 'free'));

CREATE INDEX IF NOT EXISTS idx_cases_parent_case_id ON public.cases(parent_case_id);
CREATE INDEX IF NOT EXISTS idx_cases_case_type ON public.cases(case_type);

-- Function to create a follow-up case (remake or repair)
CREATE OR REPLACE FUNCTION public.create_followup_case(
  _parent_case_id uuid,
  _case_type text,           -- 'remake' or 'repair'
  _with_new_work boolean DEFAULT false,  -- true = full new work, false = same as parent
  _charge_mode text DEFAULT 'free',      -- 'free' or 'paid'
  _custom_price numeric DEFAULT NULL,
  _notes text DEFAULT NULL,
  _due_date date DEFAULT NULL
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
  v_price numeric;
BEGIN
  IF _case_type NOT IN ('remake', 'repair') THEN
    RAISE EXCEPTION 'Invalid case type. Must be remake or repair.';
  END IF;

  IF _charge_mode NOT IN ('free', 'paid') THEN
    RAISE EXCEPTION 'Invalid charge mode. Must be free or paid.';
  END IF;

  SELECT * INTO v_parent FROM public.cases WHERE id = _parent_case_id;
  IF v_parent.id IS NULL THEN RAISE EXCEPTION 'Parent case not found'; END IF;
  IF NOT public.is_lab_member(v_parent.lab_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  -- Determine prefix
  v_prefix := CASE WHEN _case_type = 'remake' THEN 'R-' ELSE 'F-' END;

  -- Strip any existing R-/F- prefix from parent number to get base
  v_base_number := regexp_replace(v_parent.case_number, '^(R-|F-)+', '');
  v_new_number := v_prefix || v_base_number;

  -- If duplicate, append a counter
  IF EXISTS (SELECT 1 FROM public.cases WHERE lab_id = v_parent.lab_id AND case_number = v_new_number) THEN
    DECLARE v_i int := 2;
    BEGIN
      WHILE EXISTS (SELECT 1 FROM public.cases WHERE lab_id = v_parent.lab_id AND case_number = v_new_number || '/' || v_i) LOOP
        v_i := v_i + 1;
      END LOOP;
      v_new_number := v_new_number || '/' || v_i;
    END;
  END IF;

  -- Resolve workflow & start stage (use parent workflow or default)
  v_workflow_id := v_parent.workflow_id;
  IF v_workflow_id IS NULL THEN
    SELECT id INTO v_workflow_id FROM public.workflows
      WHERE lab_id = v_parent.lab_id AND is_default = true LIMIT 1;
  END IF;
  SELECT id INTO v_start_stage FROM public.workflow_stages
    WHERE workflow_id = v_workflow_id AND is_start = true LIMIT 1;

  -- Resolve price
  IF _charge_mode = 'free' THEN
    v_price := 0;
  ELSIF _custom_price IS NOT NULL THEN
    v_price := _custom_price;
  ELSE
    v_price := public.resolve_case_price(v_parent.lab_id, v_parent.work_type_id, v_parent.doctor_id);
  END IF;

  INSERT INTO public.cases (
    lab_id, case_number, doctor_id, patient_id,
    work_type_id, workflow_id, current_stage_id,
    shade, tooth_numbers, units,
    notes, price, status,
    date_received, due_date, stage_entered_at,
    created_by, parent_case_id, case_type, charge_mode
  ) VALUES (
    v_parent.lab_id, v_new_number, v_parent.doctor_id, v_parent.patient_id,
    v_parent.work_type_id, v_workflow_id, v_start_stage,
    v_parent.shade, v_parent.tooth_numbers, COALESCE(v_parent.units, 1),
    COALESCE(_notes, CASE WHEN _case_type = 'remake' THEN 'إعادة للحالة ' ELSE 'تصليح للحالة ' END || v_parent.case_number),
    v_price, 'active'::public.case_status,
    CURRENT_DATE, _due_date, now(),
    auth.uid(), _parent_case_id, _case_type, _charge_mode
  ) RETURNING id INTO v_new_id;

  -- Insert initial stage history
  IF v_start_stage IS NOT NULL THEN
    INSERT INTO public.case_stage_history (case_id, lab_id, stage_id, entered_by, entered_at)
    VALUES (v_new_id, v_parent.lab_id, v_start_stage, auth.uid(), now());
  END IF;

  -- Audit log
  INSERT INTO public.audit_log (lab_id, user_id, entity_type, entity_id, action, details)
  VALUES (v_parent.lab_id, auth.uid(), 'case', v_new_id,
    CASE WHEN _case_type = 'remake' THEN 'remake_created' ELSE 'repair_created' END,
    jsonb_build_object(
      'parent_case_id', _parent_case_id,
      'parent_case_number', v_parent.case_number,
      'with_new_work', _with_new_work,
      'charge_mode', _charge_mode,
      'price', v_price
    ));

  RETURN v_new_id;
END;
$function$;