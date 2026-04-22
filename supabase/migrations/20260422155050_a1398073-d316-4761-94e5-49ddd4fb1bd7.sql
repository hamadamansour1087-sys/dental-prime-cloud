
-- 1. Technicians table
CREATE TABLE public.technicians (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  specialty TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_technicians_lab ON public.technicians(lab_id);

ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lab members read technicians" ON public.technicians
  FOR SELECT USING (is_lab_member(lab_id));
CREATE POLICY "managers insert technicians" ON public.technicians
  FOR INSERT WITH CHECK (is_lab_manager_or_admin(lab_id));
CREATE POLICY "managers update technicians" ON public.technicians
  FOR UPDATE USING (is_lab_manager_or_admin(lab_id));
CREATE POLICY "managers delete technicians" ON public.technicians
  FOR DELETE USING (is_lab_manager_or_admin(lab_id));

CREATE TRIGGER trg_technicians_updated_at
  BEFORE UPDATE ON public.technicians
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Add technician_id and skipped flag to stage history
ALTER TABLE public.case_stage_history
  ADD COLUMN technician_id UUID REFERENCES public.technicians(id) ON DELETE SET NULL,
  ADD COLUMN skipped BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_stage_history_technician ON public.case_stage_history(technician_id);
CREATE INDEX idx_stage_history_case ON public.case_stage_history(case_id);

-- 3. Replace default workflow stages for ALL existing labs
-- Build new stage list per workflow
DO $$
DECLARE
  wf RECORD;
  ready_id UUID;
BEGIN
  FOR wf IN SELECT id, lab_id FROM public.workflows WHERE is_default = true LOOP
    -- Clear existing stages and transitions for this workflow
    DELETE FROM public.workflow_transitions WHERE workflow_id = wf.id;
    -- Null out cases.current_stage_id referencing stages we will delete
    UPDATE public.cases SET current_stage_id = NULL WHERE workflow_id = wf.id;
    DELETE FROM public.workflow_stages WHERE workflow_id = wf.id;

    -- Insert new stages
    INSERT INTO public.workflow_stages (workflow_id, lab_id, name, code, color, order_index, estimated_days, is_start, is_end, notify_doctor) VALUES
      (wf.id, wf.lab_id, 'استلام', 'received', '#3B82F6', 1, 0, true, false, false),
      (wf.id, wf.lab_id, 'تحت التشغيل', 'in_production', '#8B5CF6', 2, 2, false, false, false),
      (wf.id, wf.lab_id, 'بروفة', 'try_in_1', '#F59E0B', 3, 1, false, false, true),
      (wf.id, wf.lab_id, 'عودة من بروفة', 'return_1', '#EF4444', 4, 1, false, false, false),
      (wf.id, wf.lab_id, 'بروفة ٢', 'try_in_2', '#F97316', 5, 1, false, false, true),
      (wf.id, wf.lab_id, 'عودة من بروفة ٢', 'return_2', '#DC2626', 6, 1, false, false, false),
      (wf.id, wf.lab_id, 'جاهز للتسليم', 'ready', '#06B6D4', 7, 0, false, false, true),
      (wf.id, wf.lab_id, 'تم التسليم', 'delivered', '#059669', 8, 0, false, true, false);
  END LOOP;
END$$;

-- 4. Update bootstrap_new_user_lab to use new stages
CREATE OR REPLACE FUNCTION public.bootstrap_new_user_lab()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lab_id UUID;
  v_workflow_id UUID;
  v_role_admin UUID;
  v_role_manager UUID;
  v_role_tech UUID;
  v_lab_name TEXT;
  v_full_name TEXT;
BEGIN
  v_lab_name := COALESCE(NEW.raw_user_meta_data->>'lab_name', 'معملي');
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);

  INSERT INTO public.labs (name, code)
  VALUES (v_lab_name, 'LAB-' || substring(NEW.id::text, 1, 8))
  RETURNING id INTO v_lab_id;

  INSERT INTO public.profiles (id, lab_id, full_name)
  VALUES (NEW.id, v_lab_id, v_full_name);

  INSERT INTO public.user_roles (user_id, lab_id, role) VALUES (NEW.id, v_lab_id, 'admin');

  INSERT INTO public.roles (lab_id, name, description, is_system) VALUES
    (v_lab_id, 'مدير', 'مدير المعمل - كل الصلاحيات', true) RETURNING id INTO v_role_admin;
  INSERT INTO public.roles (lab_id, name, description, is_system) VALUES
    (v_lab_id, 'مشرف', 'مشرف الإنتاج', true) RETURNING id INTO v_role_manager;
  INSERT INTO public.roles (lab_id, name, description, is_system) VALUES
    (v_lab_id, 'فني', 'فني تركيبات', true) RETURNING id INTO v_role_tech;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_admin, id FROM public.permissions;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_manager, id FROM public.permissions
  WHERE NOT (module IN ('users','settings') AND action = 'manage');
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_tech, id FROM public.permissions
  WHERE action IN ('view','change_stage');

  INSERT INTO public.work_types (lab_id, name) VALUES
    (v_lab_id, 'تاج زيركون'),
    (v_lab_id, 'تاج بورسلين فيوزد ميتال'),
    (v_lab_id, 'جسر ٣ وحدات'),
    (v_lab_id, 'فينير'),
    (v_lab_id, 'طقم كامل'),
    (v_lab_id, 'طقم متحرك جزئي');

  INSERT INTO public.workflows (lab_id, name, is_default)
  VALUES (v_lab_id, 'سير العمل الافتراضي', true)
  RETURNING id INTO v_workflow_id;

  INSERT INTO public.workflow_stages (workflow_id, lab_id, name, code, color, order_index, estimated_days, is_start, is_end, notify_doctor) VALUES
    (v_workflow_id, v_lab_id, 'استلام', 'received', '#3B82F6', 1, 0, true, false, false),
    (v_workflow_id, v_lab_id, 'تحت التشغيل', 'in_production', '#8B5CF6', 2, 2, false, false, false),
    (v_workflow_id, v_lab_id, 'بروفة', 'try_in_1', '#F59E0B', 3, 1, false, false, true),
    (v_workflow_id, v_lab_id, 'عودة من بروفة', 'return_1', '#EF4444', 4, 1, false, false, false),
    (v_workflow_id, v_lab_id, 'بروفة ٢', 'try_in_2', '#F97316', 5, 1, false, false, true),
    (v_workflow_id, v_lab_id, 'عودة من بروفة ٢', 'return_2', '#DC2626', 6, 1, false, false, false),
    (v_workflow_id, v_lab_id, 'جاهز للتسليم', 'ready', '#06B6D4', 7, 0, false, false, true),
    (v_workflow_id, v_lab_id, 'تم التسليم', 'delivered', '#059669', 8, 0, false, true, false);

  RETURN NEW;
END;
$function$;

-- 5. Updated transition function with technician + skip support
CREATE OR REPLACE FUNCTION public.transition_case_stage(
  _case_id UUID,
  _to_stage_id UUID,
  _notes TEXT DEFAULT NULL,
  _technician_id UUID DEFAULT NULL,
  _skipped_stage_ids UUID[] DEFAULT NULL
)
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
BEGIN
  SELECT * INTO v_case FROM public.cases WHERE id = _case_id;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'Case not found'; END IF;
  IF NOT public.is_lab_member(v_case.lab_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT * INTO v_to_stage FROM public.workflow_stages WHERE id = _to_stage_id;
  IF v_to_stage.lab_id <> v_case.lab_id THEN RAISE EXCEPTION 'Stage not in same lab'; END IF;

  -- Require technician when transitioning to a stage with code 'ready'
  IF v_to_stage.code = 'ready' AND _technician_id IS NULL THEN
    RAISE EXCEPTION 'Technician required for ready stage';
  END IF;

  -- Close current open history record
  UPDATE public.case_stage_history
    SET exited_at = now(),
        duration_minutes = EXTRACT(EPOCH FROM (now() - entered_at))::INTEGER / 60
    WHERE case_id = _case_id AND exited_at IS NULL;

  -- Insert skipped stages records (entered_at = exited_at = now, skipped=true)
  IF _skipped_stage_ids IS NOT NULL THEN
    FOREACH v_skipped_id IN ARRAY _skipped_stage_ids LOOP
      SELECT * INTO v_skipped_stage FROM public.workflow_stages WHERE id = v_skipped_id;
      IF v_skipped_stage.lab_id = v_case.lab_id THEN
        INSERT INTO public.case_stage_history (case_id, lab_id, stage_id, entered_by, entered_at, exited_at, duration_minutes, skipped, notes)
        VALUES (_case_id, v_case.lab_id, v_skipped_id, auth.uid(), now(), now(), 0, true, 'تم التخطي');
      END IF;
    END LOOP;
  END IF;

  -- Insert new active history record
  INSERT INTO public.case_stage_history (case_id, lab_id, stage_id, entered_by, technician_id, notes)
  VALUES (_case_id, v_case.lab_id, _to_stage_id, auth.uid(), _technician_id, _notes);

  -- Update case
  UPDATE public.cases
    SET current_stage_id = _to_stage_id,
        stage_entered_at = now(),
        status = CASE WHEN v_to_stage.is_end THEN 'delivered'::public.case_status ELSE status END,
        date_delivered = CASE WHEN v_to_stage.is_end THEN now() ELSE date_delivered END
    WHERE id = _case_id;

  INSERT INTO public.audit_log (lab_id, user_id, entity_type, entity_id, action, details)
  VALUES (v_case.lab_id, auth.uid(), 'case', _case_id, 'stage_changed',
          jsonb_build_object('to_stage_id', _to_stage_id, 'technician_id', _technician_id, 'skipped', _skipped_stage_ids, 'notes', _notes));
END;
$function$;
