-- 1) New RPC: doctors request a remake/repair from the portal.
--    The case is created as pending_approval (no case_number yet) and
--    keeps a link to the parent case. The lab approves it later via
--    approve_pending_case which assigns the real number/workflow.
CREATE OR REPLACE FUNCTION public.request_followup_case_from_portal(
  _parent_case_id uuid,
  _case_type text,
  _notes text DEFAULT NULL,
  _shade text DEFAULT NULL,
  _tooth_numbers text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent RECORD;
  v_doctor_id uuid := public.current_doctor_id();
  v_doctor_lab uuid := public.current_doctor_lab_id();
  v_new_id uuid;
  v_temp_number text;
BEGIN
  IF _case_type NOT IN ('remake','repair') THEN
    RAISE EXCEPTION 'Invalid case type. Must be remake or repair.';
  END IF;

  IF v_doctor_id IS NULL THEN
    RAISE EXCEPTION 'Not a doctor';
  END IF;

  SELECT * INTO v_parent FROM public.cases WHERE id = _parent_case_id;
  IF v_parent.id IS NULL THEN
    RAISE EXCEPTION 'Parent case not found';
  END IF;

  IF v_parent.doctor_id <> v_doctor_id OR v_parent.lab_id <> v_doctor_lab THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Temporary case_number (NOT NULL constraint). Real number is assigned
  -- by approve_pending_case when the lab approves the request.
  v_temp_number := 'PENDING-' || substring(gen_random_uuid()::text, 1, 8);

  INSERT INTO public.cases (
    lab_id, case_number, doctor_id, patient_id, work_type_id,
    shade, tooth_numbers, units, notes, status, date_received,
    parent_case_id, case_type, charge_mode, created_by
  ) VALUES (
    v_doctor_lab, v_temp_number, v_doctor_id, v_parent.patient_id, v_parent.work_type_id,
    COALESCE(_shade, v_parent.shade),
    COALESCE(_tooth_numbers, v_parent.tooth_numbers),
    COALESCE(v_parent.units, 1),
    COALESCE(_notes,
      CASE WHEN _case_type = 'remake' THEN 'طلب إعادة من البورتال للحالة ' ELSE 'طلب تصليح من البورتال للحالة ' END
      || v_parent.case_number),
    'pending_approval'::public.case_status,
    CURRENT_DATE,
    _parent_case_id,
    _case_type,
    'free',
    auth.uid()
  ) RETURNING id INTO v_new_id;

  INSERT INTO public.audit_log (lab_id, user_id, entity_type, entity_id, action, details)
  VALUES (
    v_doctor_lab, auth.uid(), 'case', v_new_id,
    CASE WHEN _case_type = 'remake' THEN 'remake_requested_from_portal' ELSE 'repair_requested_from_portal' END,
    jsonb_build_object(
      'parent_case_id', _parent_case_id,
      'parent_case_number', v_parent.case_number
    )
  );

  RETURN v_new_id;
END;
$$;

-- 2) Patch approve_pending_case so when the lab approves a portal request
--    it preserves parent_case_id + case_type and uses the right numbering
--    prefix (R- for remake, F- for repair).
CREATE OR REPLACE FUNCTION public.approve_pending_case(_case_id uuid, _workflow_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_case RECORD;
  v_workflow_id uuid;
  v_start_stage RECORD;
  v_new_number text;
  v_parent RECORD;
  v_prefix text;
  v_base text;
  v_i int;
BEGIN
  SELECT * INTO v_case FROM public.cases WHERE id = _case_id;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'Case not found'; END IF;
  IF NOT public.is_lab_manager_or_admin(v_case.lab_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_case.status <> 'pending_approval'::public.case_status THEN RAISE EXCEPTION 'Case not pending'; END IF;

  v_workflow_id := COALESCE(_workflow_id, v_case.workflow_id);
  IF v_workflow_id IS NULL THEN
    SELECT id INTO v_workflow_id FROM public.workflows WHERE lab_id = v_case.lab_id AND is_default = true LIMIT 1;
  END IF;
  SELECT * INTO v_start_stage FROM public.workflow_stages WHERE workflow_id = v_workflow_id AND is_start = true LIMIT 1;

  -- If this is a remake/repair linked to a parent, use R-/F- numbering
  IF v_case.parent_case_id IS NOT NULL AND v_case.case_type IN ('remake','repair') THEN
    SELECT * INTO v_parent FROM public.cases WHERE id = v_case.parent_case_id;
    v_prefix := CASE WHEN v_case.case_type = 'remake' THEN 'R-' ELSE 'F-' END;
    v_base := regexp_replace(COALESCE(v_parent.case_number, ''), '^(R-|F-)+', '');
    v_new_number := v_prefix || v_base;
    IF EXISTS (SELECT 1 FROM public.cases WHERE lab_id = v_case.lab_id AND case_number = v_new_number AND id <> _case_id) THEN
      v_i := 2;
      WHILE EXISTS (SELECT 1 FROM public.cases WHERE lab_id = v_case.lab_id AND case_number = v_new_number || '/' || v_i AND id <> _case_id) LOOP
        v_i := v_i + 1;
      END LOOP;
      v_new_number := v_new_number || '/' || v_i;
    END IF;
  ELSE
    v_new_number := public.generate_case_number(v_case.lab_id);
  END IF;

  UPDATE public.cases SET
    status = 'active'::public.case_status,
    workflow_id = v_workflow_id,
    current_stage_id = v_start_stage.id,
    stage_entered_at = now(),
    case_number = v_new_number,
    date_received = CURRENT_DATE,
    price = COALESCE(price, public.resolve_case_price(lab_id, work_type_id, doctor_id))
  WHERE id = _case_id;

  INSERT INTO public.case_stage_history (case_id, lab_id, stage_id, entered_by, entered_at)
  VALUES (_case_id, v_case.lab_id, v_start_stage.id, auth.uid(), now());

  INSERT INTO public.audit_log (lab_id, user_id, entity_type, entity_id, action, details)
  VALUES (v_case.lab_id, auth.uid(), 'case', _case_id, 'approved_from_portal',
    jsonb_build_object('case_number', v_new_number, 'case_type', v_case.case_type, 'parent_case_id', v_case.parent_case_id));

  RETURN _case_id;
END;
$function$;