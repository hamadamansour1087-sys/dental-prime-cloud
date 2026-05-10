-- 1) Rename existing workflow stages for ALL labs
UPDATE public.workflow_stages SET name = 'تم التسليم' WHERE code = 'ready';
UPDATE public.workflow_stages SET name = 'تأكيد التسليم' WHERE code = 'delivered';

-- 2) Update transition_case_stage so moving to a stage with code='ready' marks the case as delivered (billable)
CREATE OR REPLACE FUNCTION public.transition_case_stage(
  _case_id uuid,
  _to_stage_id uuid,
  _notes text DEFAULT NULL::text,
  _technician_id uuid DEFAULT NULL::uuid,
  _skipped_stage_ids uuid[] DEFAULT NULL::uuid[],
  _entered_at timestamp with time zone DEFAULT NULL::timestamp with time zone
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
  v_at TIMESTAMPTZ := COALESCE(_entered_at, now());
  v_marks_delivered BOOLEAN;
BEGIN
  SELECT * INTO v_case FROM public.cases WHERE id = _case_id;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'Case not found'; END IF;
  IF NOT public.is_lab_member(v_case.lab_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT * INTO v_to_stage FROM public.workflow_stages WHERE id = _to_stage_id;
  IF v_to_stage.lab_id <> v_case.lab_id THEN RAISE EXCEPTION 'Stage not in same lab'; END IF;

  IF v_to_stage.code = 'ready' AND _technician_id IS NULL THEN
    RAISE EXCEPTION 'Technician required for ready stage';
  END IF;

  -- A stage marks the case as delivered (billable) if it's the end stage OR has code='ready'
  v_marks_delivered := v_to_stage.is_end OR v_to_stage.code = 'ready';

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
        status = CASE WHEN v_marks_delivered THEN 'delivered'::public.case_status ELSE status END,
        date_delivered = CASE WHEN v_marks_delivered AND date_delivered IS NULL THEN v_at ELSE date_delivered END
    WHERE id = _case_id;

  INSERT INTO public.audit_log (lab_id, user_id, entity_type, entity_id, action, details)
  VALUES (v_case.lab_id, auth.uid(), 'case', _case_id, 'stage_changed',
          jsonb_build_object('to_stage_id', _to_stage_id, 'technician_id', _technician_id, 'skipped', _skipped_stage_ids, 'notes', _notes, 'entered_at', v_at));
END;
$function$;

-- 3) Update bootstrap_new_user_lab so new labs get the new names
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
  v_self_signup BOOLEAN;
  v_cat_zircon UUID;
  v_cat_porcelain UUID;
  v_cat_acrylic UUID;
BEGIN
  v_self_signup := COALESCE((NEW.raw_user_meta_data->>'self_signup')::boolean, false);
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);

  IF v_self_signup THEN
    INSERT INTO public.profiles (id, lab_id, full_name) VALUES (NEW.id, NULL, v_full_name);
    RETURN NEW;
  END IF;

  v_lab_name := COALESCE(NEW.raw_user_meta_data->>'lab_name', 'معملي');

  INSERT INTO public.labs (name, code) VALUES (v_lab_name, 'LAB-' || substring(NEW.id::text, 1, 8)) RETURNING id INTO v_lab_id;
  INSERT INTO public.profiles (id, lab_id, full_name) VALUES (NEW.id, v_lab_id, v_full_name);
  INSERT INTO public.user_roles (user_id, lab_id, role) VALUES (NEW.id, v_lab_id, 'admin');

  INSERT INTO public.roles (lab_id, name, description, is_system) VALUES
    (v_lab_id, 'مدير', 'مدير المعمل - كل الصلاحيات', true) RETURNING id INTO v_role_admin;
  INSERT INTO public.roles (lab_id, name, description, is_system) VALUES
    (v_lab_id, 'مشرف', 'مشرف الإنتاج', true) RETURNING id INTO v_role_manager;
  INSERT INTO public.roles (lab_id, name, description, is_system) VALUES
    (v_lab_id, 'فني', 'فني تركيبات', true) RETURNING id INTO v_role_tech;

  INSERT INTO public.role_permissions (role_id, permission_id) SELECT v_role_admin, id FROM public.permissions;
  INSERT INTO public.role_permissions (role_id, permission_id) SELECT v_role_manager, id FROM public.permissions
    WHERE NOT (module IN ('users','settings') AND action = 'manage');
  INSERT INTO public.role_permissions (role_id, permission_id) SELECT v_role_tech, id FROM public.permissions
    WHERE action IN ('view','change_stage');

  INSERT INTO public.work_type_categories (lab_id, name, description, avg_delivery_days, color, order_index)
  VALUES (v_lab_id, 'زيركون', 'زيركون / كاد كام / إيماكس', 5, '#3B82F6', 1) RETURNING id INTO v_cat_zircon;
  INSERT INTO public.work_type_categories (lab_id, name, description, avg_delivery_days, color, order_index)
  VALUES (v_lab_id, 'بورسلين', 'بورسلين 3D / VM13 / وجه بورسلين / معدن', 7, '#8B5CF6', 2) RETURNING id INTO v_cat_porcelain;
  INSERT INTO public.work_type_categories (lab_id, name, description, avg_delivery_days, color, order_index)
  VALUES (v_lab_id, 'أكريل', 'فلاكسبول / طقم متحرك', 4, '#F59E0B', 3) RETURNING id INTO v_cat_acrylic;
  INSERT INTO public.work_type_categories (lab_id, name, description, avg_delivery_days, color, order_index)
  VALUES (v_lab_id, 'تقويم/أجهزة', 'واقيات ليلية / تقويم / Splints', 6, '#10B981', 4);
  INSERT INTO public.work_type_categories (lab_id, name, description, avg_delivery_days, color, order_index)
  VALUES (v_lab_id, 'أخرى', 'فئة عامة', 5, '#6B7280', 5);

  INSERT INTO public.work_types (lab_id, name, category_id) VALUES
    (v_lab_id, 'تاج زيركون', v_cat_zircon),
    (v_lab_id, 'تاج بورسلين فيوزد ميتال', v_cat_porcelain),
    (v_lab_id, 'جسر ٣ وحدات', v_cat_porcelain),
    (v_lab_id, 'فينير', v_cat_porcelain),
    (v_lab_id, 'طقم كامل', v_cat_acrylic),
    (v_lab_id, 'طقم متحرك جزئي', v_cat_acrylic);

  INSERT INTO public.workflows (lab_id, name, is_default)
  VALUES (v_lab_id, 'سير العمل الافتراضي', true) RETURNING id INTO v_workflow_id;

  INSERT INTO public.workflow_stages (workflow_id, lab_id, name, code, color, order_index, estimated_days, is_start, is_end, notify_doctor) VALUES
    (v_workflow_id, v_lab_id, 'دخول المعمل', 'received', '#3B82F6', 1, 0, true, false, false),
    (v_workflow_id, v_lab_id, 'تحت التشغيل', 'in_production', '#8B5CF6', 2, 2, false, false, false),
    (v_workflow_id, v_lab_id, 'بروفة', 'try_in_1', '#F59E0B', 3, 1, false, false, true),
    (v_workflow_id, v_lab_id, 'عودة من بروفة', 'return_1', '#EF4444', 4, 1, false, false, false),
    (v_workflow_id, v_lab_id, 'بروفة ٢', 'try_in_2', '#F97316', 5, 1, false, false, true),
    (v_workflow_id, v_lab_id, 'عودة من بروفة ٢', 'return_2', '#DC2626', 6, 1, false, false, false),
    (v_workflow_id, v_lab_id, 'تم التسليم', 'ready', '#06B6D4', 7, 0, false, false, true),
    (v_workflow_id, v_lab_id, 'تأكيد التسليم', 'delivered', '#059669', 8, 0, false, true, false);

  RETURN NEW;
END;
$function$;