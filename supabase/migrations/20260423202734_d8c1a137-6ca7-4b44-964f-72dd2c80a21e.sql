CREATE OR REPLACE FUNCTION public.transition_case_stage(_case_id uuid, _to_stage_id uuid, _notes text DEFAULT NULL::text, _technician_id uuid DEFAULT NULL::uuid, _skipped_stage_ids uuid[] DEFAULT NULL::uuid[], _entered_at timestamptz DEFAULT NULL::timestamptz)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_case RECORD;
  v_to_stage RECORD;
  v_skipped_id UUID;
  v_skipped_stage RECORD;
  v_at TIMESTAMPTZ := COALESCE(_entered_at, now());
BEGIN
  SELECT * INTO v_case FROM public.cases WHERE id = _case_id;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'Case not found'; END IF;
  IF NOT public.is_lab_member(v_case.lab_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT * INTO v_to_stage FROM public.workflow_stages WHERE id = _to_stage_id;
  IF v_to_stage.lab_id <> v_case.lab_id THEN RAISE EXCEPTION 'Stage not in same lab'; END IF;

  IF v_to_stage.code = 'ready' AND _technician_id IS NULL THEN
    RAISE EXCEPTION 'Technician required for ready stage';
  END IF;

  UPDATE public.case_stage_history
    SET exited_at = v_at,
        duration_minutes = GREATEST(EXTRACT(EPOCH FROM (v_at - entered_at))::INTEGER / 60, 0)
    WHERE case_id = _case_id AND exited_at IS NULL;

  IF _skipped_stage_ids IS NOT NULL THEN
    FOREACH v_skipped_id IN ARRAY _skipped_stage_ids LOOP
      SELECT * INTO v_skipped_stage FROM public.workflow_stages WHERE id = v_skipped_id;
      IF v_skipped_stage.lab_id = v_case.lab_id THEN
        INSERT INTO public.case_stage_history (case_id, lab_id, stage_id, entered_by, entered_at, exited_at, duration_minutes, skipped, notes)
        VALUES (_case_id, v_case.lab_id, v_skipped_id, auth.uid(), v_at, v_at, 0, true, 'تم التخطي');
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.case_stage_history (case_id, lab_id, stage_id, entered_by, technician_id, notes, entered_at)
  VALUES (_case_id, v_case.lab_id, _to_stage_id, auth.uid(), _technician_id, _notes, v_at);

  UPDATE public.cases
    SET current_stage_id = _to_stage_id,
        stage_entered_at = v_at,
        status = CASE WHEN v_to_stage.is_end THEN 'delivered'::public.case_status ELSE status END,
        date_delivered = CASE WHEN v_to_stage.is_end THEN v_at ELSE date_delivered END
    WHERE id = _case_id;

  INSERT INTO public.audit_log (lab_id, user_id, entity_type, entity_id, action, details)
  VALUES (v_case.lab_id, auth.uid(), 'case', _case_id, 'stage_changed',
          jsonb_build_object('to_stage_id', _to_stage_id, 'technician_id', _technician_id, 'skipped', _skipped_stage_ids, 'notes', _notes, 'entered_at', v_at));
END;
$function$;