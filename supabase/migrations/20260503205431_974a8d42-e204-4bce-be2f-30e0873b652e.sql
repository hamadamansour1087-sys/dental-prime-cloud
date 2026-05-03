CREATE OR REPLACE FUNCTION public.approve_lab_request(
  _request_id uuid,
  _trial_days integer DEFAULT 14
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req record;
  _lab_id uuid;
  _workflow_id uuid;
  _role_admin uuid;
  _role_manager uuid;
  _role_tech uuid;
  _cat_zircon uuid;
  _cat_porcelain uuid;
  _cat_acrylic uuid;
BEGIN
  SELECT * INTO _req FROM public.lab_requests WHERE id = _request_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  -- Create the lab with trial
  INSERT INTO public.labs (name, email, phone, address, code, subscription_status, trial_days, trial_start_date)
  VALUES (_req.lab_name, _req.email, _req.phone, _req.address, 'LAB-' || substring(_req.user_id::text, 1, 8), 'trial', _trial_days, CURRENT_DATE)
  RETURNING id INTO _lab_id;

  -- Link profile
  UPDATE public.profiles SET lab_id = _lab_id WHERE id = _req.user_id;

  -- Give admin role
  INSERT INTO public.user_roles (user_id, lab_id, role) VALUES (_req.user_id, _lab_id, 'admin');

  -- Create system roles
  INSERT INTO public.roles (lab_id, name, description, is_system) VALUES
    (_lab_id, 'مدير', 'مدير المعمل - كل الصلاحيات', true) RETURNING id INTO _role_admin;
  INSERT INTO public.roles (lab_id, name, description, is_system) VALUES
    (_lab_id, 'مشرف', 'مشرف الإنتاج', true) RETURNING id INTO _role_manager;
  INSERT INTO public.roles (lab_id, name, description, is_system) VALUES
    (_lab_id, 'فني', 'فني تركيبات', true) RETURNING id INTO _role_tech;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT _role_admin, id FROM public.permissions;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT _role_manager, id FROM public.permissions
  WHERE NOT (module IN ('users','settings') AND action = 'manage');
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT _role_tech, id FROM public.permissions
  WHERE action IN ('view','change_stage');

  -- Work type categories
  INSERT INTO public.work_type_categories (lab_id, name, description, avg_delivery_days, color, order_index)
  VALUES (_lab_id, 'زيركون', 'زيركون / كاد كام / إيماكس', 5, '#3B82F6', 1) RETURNING id INTO _cat_zircon;
  INSERT INTO public.work_type_categories (lab_id, name, description, avg_delivery_days, color, order_index)
  VALUES (_lab_id, 'بورسلين', 'بورسلين 3D / VM13 / وجه بورسلين / معدن', 7, '#8B5CF6', 2) RETURNING id INTO _cat_porcelain;
  INSERT INTO public.work_type_categories (lab_id, name, description, avg_delivery_days, color, order_index)
  VALUES (_lab_id, 'أكريل', 'فلاكسبول / طقم متحرك', 4, '#F59E0B', 3) RETURNING id INTO _cat_acrylic;
  INSERT INTO public.work_type_categories (lab_id, name, description, avg_delivery_days, color, order_index)
  VALUES (_lab_id, 'تقويم/أجهزة', 'واقيات ليلية / تقويم / Splints', 6, '#10B981', 4);
  INSERT INTO public.work_type_categories (lab_id, name, description, avg_delivery_days, color, order_index)
  VALUES (_lab_id, 'أخرى', 'فئة عامة', 5, '#6B7280', 5);

  INSERT INTO public.work_types (lab_id, name, category_id) VALUES
    (_lab_id, 'تاج زيركون', _cat_zircon),
    (_lab_id, 'تاج بورسلين فيوزد ميتال', _cat_porcelain),
    (_lab_id, 'جسر ٣ وحدات', _cat_porcelain),
    (_lab_id, 'فينير', _cat_porcelain),
    (_lab_id, 'طقم كامل', _cat_acrylic),
    (_lab_id, 'طقم متحرك جزئي', _cat_acrylic);

  -- Default workflow
  INSERT INTO public.workflows (lab_id, name, is_default)
  VALUES (_lab_id, 'سير العمل الافتراضي', true)
  RETURNING id INTO _workflow_id;

  INSERT INTO public.workflow_stages (workflow_id, lab_id, name, code, color, order_index, estimated_days, is_start, is_end, notify_doctor) VALUES
    (_workflow_id, _lab_id, 'دخول المعمل', 'received', '#3B82F6', 1, 0, true, false, false),
    (_workflow_id, _lab_id, 'تحت التشغيل', 'in_production', '#8B5CF6', 2, 2, false, false, false),
    (_workflow_id, _lab_id, 'بروفة', 'try_in_1', '#F59E0B', 3, 1, false, false, true),
    (_workflow_id, _lab_id, 'عودة من بروفة', 'return_1', '#EF4444', 4, 1, false, false, false),
    (_workflow_id, _lab_id, 'بروفة ٢', 'try_in_2', '#F97316', 5, 1, false, false, true),
    (_workflow_id, _lab_id, 'عودة من بروفة ٢', 'return_2', '#DC2626', 6, 1, false, false, false),
    (_workflow_id, _lab_id, 'جاهز للتسليم', 'ready', '#06B6D4', 7, 0, false, false, true),
    (_workflow_id, _lab_id, 'تم التسليم', 'delivered', '#059669', 8, 0, false, true, false);

  -- Update request
  UPDATE public.lab_requests
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      created_lab_id = _lab_id,
      updated_at = now()
  WHERE id = _request_id;

  RETURN _lab_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_lab_request(uuid, integer) FROM anon;