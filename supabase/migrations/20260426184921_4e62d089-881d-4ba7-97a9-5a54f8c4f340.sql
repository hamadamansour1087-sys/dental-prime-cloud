-- 1) Rename existing "received" stages across all labs/workflows
UPDATE public.workflow_stages
SET name = 'دخول المعمل'
WHERE code = 'received' OR name = 'استلام';

-- 2) Update bootstrap function for new labs
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
  v_cat_zircon UUID;
  v_cat_porcelain UUID;
  v_cat_acrylic UUID;
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
  VALUES (v_lab_id, 'سير العمل الافتراضي', true)
  RETURNING id INTO v_workflow_id;

  INSERT INTO public.workflow_stages (workflow_id, lab_id, name, code, color, order_index, estimated_days, is_start, is_end, notify_doctor) VALUES
    (v_workflow_id, v_lab_id, 'دخول المعمل', 'received', '#3B82F6', 1, 0, true, false, false),
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