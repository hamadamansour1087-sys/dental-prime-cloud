
-- 1) Create a new workflow with optional starter stages
CREATE OR REPLACE FUNCTION public.create_workflow(_name text, _description text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_lab_id uuid; v_wf_id uuid;
BEGIN
  v_lab_id := public.current_lab_id();
  IF v_lab_id IS NULL THEN RAISE EXCEPTION 'No lab'; END IF;
  IF NOT public.is_lab_admin(v_lab_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  INSERT INTO public.workflows (lab_id, name, description, is_default)
  VALUES (v_lab_id, _name, _description, false)
  RETURNING id INTO v_wf_id;

  -- Seed with start + end stages so it's usable
  INSERT INTO public.workflow_stages (workflow_id, lab_id, name, code, color, order_index, is_start, is_end, estimated_days)
  VALUES
    (v_wf_id, v_lab_id, 'استلام', 'received_' || substring(v_wf_id::text,1,8), '#3B82F6', 1, true, false, 0),
    (v_wf_id, v_lab_id, 'تم التسليم', 'delivered_' || substring(v_wf_id::text,1,8), '#059669', 2, false, true, 0);

  RETURN v_wf_id;
END;
$$;

-- 2) Rename / describe / activate workflow
CREATE OR REPLACE FUNCTION public.update_workflow(_workflow_id uuid, _name text, _description text DEFAULT NULL, _is_active boolean DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_wf RECORD;
BEGIN
  SELECT * INTO v_wf FROM public.workflows WHERE id = _workflow_id;
  IF v_wf.id IS NULL THEN RAISE EXCEPTION 'Workflow not found'; END IF;
  IF NOT public.is_lab_admin(v_wf.lab_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  UPDATE public.workflows
  SET name = COALESCE(_name, name),
      description = COALESCE(_description, description),
      is_active = COALESCE(_is_active, is_active),
      updated_at = now()
  WHERE id = _workflow_id;
END;
$$;

-- 3) Set a workflow as default (one per lab)
CREATE OR REPLACE FUNCTION public.set_default_workflow(_workflow_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_wf RECORD;
BEGIN
  SELECT * INTO v_wf FROM public.workflows WHERE id = _workflow_id;
  IF v_wf.id IS NULL THEN RAISE EXCEPTION 'Workflow not found'; END IF;
  IF NOT public.is_lab_admin(v_wf.lab_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  UPDATE public.workflows SET is_default = false WHERE lab_id = v_wf.lab_id;
  UPDATE public.workflows SET is_default = true, is_active = true WHERE id = _workflow_id;
END;
$$;

-- 4) Delete a workflow (block if it has cases, unless _force = true which migrates them to default)
CREATE OR REPLACE FUNCTION public.delete_workflow(_workflow_id uuid, _force boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_wf RECORD; v_count int; v_default uuid; v_start uuid;
BEGIN
  SELECT * INTO v_wf FROM public.workflows WHERE id = _workflow_id;
  IF v_wf.id IS NULL THEN RAISE EXCEPTION 'Workflow not found'; END IF;
  IF NOT public.is_lab_admin(v_wf.lab_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_wf.is_default THEN RAISE EXCEPTION 'لا يمكن حذف سير العمل الافتراضي'; END IF;

  SELECT COUNT(*) INTO v_count FROM public.cases WHERE workflow_id = _workflow_id;
  IF v_count > 0 THEN
    IF NOT _force THEN
      RAISE EXCEPTION 'يوجد % حالة مرتبطة. فعّل النقل القسري للمتابعة.', v_count;
    END IF;
    SELECT id INTO v_default FROM public.workflows WHERE lab_id = v_wf.lab_id AND is_default = true LIMIT 1;
    IF v_default IS NULL THEN RAISE EXCEPTION 'لا يوجد سير عمل افتراضي للنقل إليه'; END IF;
    SELECT id INTO v_start FROM public.workflow_stages WHERE workflow_id = v_default AND is_start = true LIMIT 1;
    UPDATE public.cases SET workflow_id = v_default, current_stage_id = v_start, stage_entered_at = now()
      WHERE workflow_id = _workflow_id;
  END IF;

  DELETE FROM public.workflow_stages WHERE workflow_id = _workflow_id;
  DELETE FROM public.workflow_transitions WHERE workflow_id = _workflow_id;
  DELETE FROM public.workflows WHERE id = _workflow_id;
END;
$$;

-- 5) Add stage to a workflow (auto order_index = max+1 if NULL)
CREATE OR REPLACE FUNCTION public.add_workflow_stage(
  _workflow_id uuid, _name text, _color text DEFAULT '#6B7280',
  _estimated_days int DEFAULT 0, _notify_doctor boolean DEFAULT false,
  _order_index int DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_wf RECORD; v_order int; v_id uuid; v_code text;
BEGIN
  SELECT * INTO v_wf FROM public.workflows WHERE id = _workflow_id;
  IF v_wf.id IS NULL THEN RAISE EXCEPTION 'Workflow not found'; END IF;
  IF NOT public.is_lab_admin(v_wf.lab_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  IF _order_index IS NULL THEN
    SELECT COALESCE(MAX(order_index),0)+1 INTO v_order FROM public.workflow_stages WHERE workflow_id = _workflow_id;
  ELSE
    v_order := _order_index;
    -- shift others
    UPDATE public.workflow_stages SET order_index = order_index + 1
      WHERE workflow_id = _workflow_id AND order_index >= v_order;
  END IF;

  v_code := 'stage_' || substring(gen_random_uuid()::text,1,8);

  INSERT INTO public.workflow_stages (workflow_id, lab_id, name, code, color, order_index, estimated_days, notify_doctor, is_start, is_end)
  VALUES (_workflow_id, v_wf.lab_id, _name, v_code, _color, v_order, _estimated_days, _notify_doctor, false, false)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 6) Update stage
CREATE OR REPLACE FUNCTION public.update_workflow_stage(
  _stage_id uuid, _name text DEFAULT NULL, _color text DEFAULT NULL,
  _estimated_days int DEFAULT NULL, _notify_doctor boolean DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_st RECORD;
BEGIN
  SELECT * INTO v_st FROM public.workflow_stages WHERE id = _stage_id;
  IF v_st.id IS NULL THEN RAISE EXCEPTION 'Stage not found'; END IF;
  IF NOT public.is_lab_admin(v_st.lab_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  UPDATE public.workflow_stages SET
    name = COALESCE(_name, name),
    color = COALESCE(_color, color),
    estimated_days = COALESCE(_estimated_days, estimated_days),
    notify_doctor = COALESCE(_notify_doctor, notify_doctor)
  WHERE id = _stage_id;
END;
$$;

-- 7) Delete stage (block if start/end or has any case currently on it or in history)
CREATE OR REPLACE FUNCTION public.delete_workflow_stage(_stage_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_st RECORD; v_used int;
BEGIN
  SELECT * INTO v_st FROM public.workflow_stages WHERE id = _stage_id;
  IF v_st.id IS NULL THEN RAISE EXCEPTION 'Stage not found'; END IF;
  IF NOT public.is_lab_admin(v_st.lab_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_st.is_start OR v_st.is_end THEN RAISE EXCEPTION 'لا يمكن حذف مرحلة البداية أو النهاية'; END IF;

  SELECT COUNT(*) INTO v_used FROM public.cases WHERE current_stage_id = _stage_id;
  IF v_used > 0 THEN RAISE EXCEPTION 'يوجد % حالة في هذه المرحلة. انقلها أولًا.', v_used; END IF;

  SELECT COUNT(*) INTO v_used FROM public.case_stage_history WHERE stage_id = _stage_id;
  IF v_used > 0 THEN RAISE EXCEPTION 'هذه المرحلة مستخدمة في سجل الحالات ولا يمكن حذفها.'; END IF;

  DELETE FROM public.workflow_transitions WHERE from_stage_id = _stage_id OR to_stage_id = _stage_id;
  DELETE FROM public.workflow_stages WHERE id = _stage_id;

  -- compact order_index
  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY order_index) AS rn
    FROM public.workflow_stages WHERE workflow_id = v_st.workflow_id
  )
  UPDATE public.workflow_stages s SET order_index = o.rn FROM ordered o WHERE s.id = o.id;
END;
$$;

-- 8) Reorder all stages in a workflow at once
CREATE OR REPLACE FUNCTION public.reorder_workflow_stages(_workflow_id uuid, _ordered_stage_ids uuid[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_wf RECORD; v_id uuid; v_idx int := 1;
BEGIN
  SELECT * INTO v_wf FROM public.workflows WHERE id = _workflow_id;
  IF v_wf.id IS NULL THEN RAISE EXCEPTION 'Workflow not found'; END IF;
  IF NOT public.is_lab_admin(v_wf.lab_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  -- Use large temp values to avoid unique-ish conflicts during shuffle
  UPDATE public.workflow_stages SET order_index = order_index + 10000 WHERE workflow_id = _workflow_id;

  FOREACH v_id IN ARRAY _ordered_stage_ids LOOP
    UPDATE public.workflow_stages SET order_index = v_idx
      WHERE id = v_id AND workflow_id = _workflow_id;
    v_idx := v_idx + 1;
  END LOOP;
END;
$$;
