CREATE OR REPLACE FUNCTION public.current_doctor_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.doctors WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_doctor_lab_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lab_id FROM public.doctors WHERE user_id = auth.uid() LIMIT 1;
$$;

DROP POLICY IF EXISTS "doctor reads own row" ON public.doctors;
CREATE POLICY "doctor reads own row" ON public.doctors FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "doctor reads own cases" ON public.cases;
CREATE POLICY "doctor reads own cases" ON public.cases FOR SELECT USING (doctor_id = public.current_doctor_id());

DROP POLICY IF EXISTS "doctor inserts pending cases" ON public.cases;
CREATE POLICY "doctor inserts pending cases" ON public.cases FOR INSERT WITH CHECK (
  doctor_id = public.current_doctor_id()
  AND lab_id = public.current_doctor_lab_id()
  AND status = 'pending_approval'::public.case_status
);

DROP POLICY IF EXISTS "doctor reads own case attachments" ON public.case_attachments;
CREATE POLICY "doctor reads own case attachments" ON public.case_attachments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.doctor_id = public.current_doctor_id())
);

DROP POLICY IF EXISTS "doctor inserts own case attachments" ON public.case_attachments;
CREATE POLICY "doctor inserts own case attachments" ON public.case_attachments FOR INSERT WITH CHECK (
  lab_id = public.current_doctor_lab_id()
  AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.doctor_id = public.current_doctor_id())
);

DROP POLICY IF EXISTS "doctor reads own case items" ON public.case_items;
CREATE POLICY "doctor reads own case items" ON public.case_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.doctor_id = public.current_doctor_id())
);

DROP POLICY IF EXISTS "doctor inserts own case items" ON public.case_items;
CREATE POLICY "doctor inserts own case items" ON public.case_items FOR INSERT WITH CHECK (
  lab_id = public.current_doctor_lab_id()
  AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.doctor_id = public.current_doctor_id() AND c.status = 'pending_approval'::public.case_status)
);

DROP POLICY IF EXISTS "doctor reads own payments" ON public.payments;
CREATE POLICY "doctor reads own payments" ON public.payments FOR SELECT USING (doctor_id = public.current_doctor_id());

DROP POLICY IF EXISTS "doctor reads own stage history" ON public.case_stage_history;
CREATE POLICY "doctor reads own stage history" ON public.case_stage_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.doctor_id = public.current_doctor_id())
);

DROP POLICY IF EXISTS "doctor reads lab stages" ON public.workflow_stages;
CREATE POLICY "doctor reads lab stages" ON public.workflow_stages FOR SELECT USING (lab_id = public.current_doctor_lab_id());

DROP POLICY IF EXISTS "doctor reads lab work_types" ON public.work_types;
CREATE POLICY "doctor reads lab work_types" ON public.work_types FOR SELECT USING (lab_id = public.current_doctor_lab_id());

DROP POLICY IF EXISTS "doctor reads own lab" ON public.labs;
CREATE POLICY "doctor reads own lab" ON public.labs FOR SELECT USING (id = public.current_doctor_lab_id());

DROP POLICY IF EXISTS "doctor upload own case files" ON storage.objects;
CREATE POLICY "doctor upload own case files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'case-attachments' AND public.current_doctor_id() IS NOT NULL
);

DROP POLICY IF EXISTS "doctor read own case files" ON storage.objects;
CREATE POLICY "doctor read own case files" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'case-attachments' AND public.current_doctor_id() IS NOT NULL
);

CREATE OR REPLACE FUNCTION public.approve_pending_case(_case_id uuid, _workflow_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_case RECORD; v_workflow_id uuid; v_start_stage RECORD; v_new_number text;
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
  v_new_number := public.generate_case_number(v_case.lab_id);

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
  VALUES (v_case.lab_id, auth.uid(), 'case', _case_id, 'approved_from_portal', jsonb_build_object('case_number', v_new_number));

  RETURN _case_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_pending_case(_case_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_case RECORD;
BEGIN
  SELECT * INTO v_case FROM public.cases WHERE id = _case_id;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'Case not found'; END IF;
  IF NOT public.is_lab_manager_or_admin(v_case.lab_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.cases SET status = 'cancelled'::public.case_status,
    notes = COALESCE(notes,'') || E'\n[رفض من المعمل]: ' || COALESCE(_reason,'')
    WHERE id = _case_id;
  INSERT INTO public.audit_log (lab_id, user_id, entity_type, entity_id, action, details)
  VALUES (v_case.lab_id, auth.uid(), 'case', _case_id, 'rejected_from_portal', jsonb_build_object('reason', _reason));
END;
$$;