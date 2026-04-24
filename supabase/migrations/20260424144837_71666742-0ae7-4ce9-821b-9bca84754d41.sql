-- 1) Create work_type_categories table
CREATE TABLE public.work_type_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lab_id uuid NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  avg_delivery_days integer NOT NULL DEFAULT 5,
  color text NOT NULL DEFAULT '#6B7280',
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wtc_lab ON public.work_type_categories(lab_id);

ALTER TABLE public.work_type_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lab members read wtc"
  ON public.work_type_categories FOR SELECT
  USING (public.is_lab_member(lab_id));

CREATE POLICY "doctor reads lab wtc"
  ON public.work_type_categories FOR SELECT
  USING (lab_id = public.current_doctor_lab_id());

CREATE POLICY "managers insert wtc"
  ON public.work_type_categories FOR INSERT
  WITH CHECK (public.is_lab_manager_or_admin(lab_id));

CREATE POLICY "managers update wtc"
  ON public.work_type_categories FOR UPDATE
  USING (public.is_lab_manager_or_admin(lab_id));

CREATE POLICY "managers delete wtc"
  ON public.work_type_categories FOR DELETE
  USING (public.is_lab_manager_or_admin(lab_id));

CREATE TRIGGER wtc_set_updated_at
  BEFORE UPDATE ON public.work_type_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Add category_id column to work_types
ALTER TABLE public.work_types
  ADD COLUMN category_id uuid REFERENCES public.work_type_categories(id) ON DELETE SET NULL;

CREATE INDEX idx_work_types_category ON public.work_types(category_id);

-- 3) Seed default categories for every existing lab
INSERT INTO public.work_type_categories (lab_id, name, description, avg_delivery_days, color, order_index)
SELECT l.id, 'زيركون', 'زيركون / كاد كام / إيماكس', 5, '#3B82F6', 1 FROM public.labs l
UNION ALL
SELECT l.id, 'بورسلين', 'بورسلين 3D / VM13 / وجه بورسلين / معدن', 7, '#8B5CF6', 2 FROM public.labs l
UNION ALL
SELECT l.id, 'أكريل', 'فلاكسبول / طقم متحرك', 4, '#F59E0B', 3 FROM public.labs l
UNION ALL
SELECT l.id, 'تقويم/أجهزة', 'واقيات ليلية / تقويم / Splints', 6, '#10B981', 4 FROM public.labs l
UNION ALL
SELECT l.id, 'أخرى', 'فئة عامة', 5, '#6B7280', 5 FROM public.labs l;

-- 4) Auto-assign categories to existing work_types based on name
UPDATE public.work_types wt SET category_id = c.id
FROM public.work_type_categories c
WHERE c.lab_id = wt.lab_id AND c.name = 'زيركون'
  AND (wt.name ILIKE '%زيركون%' OR wt.name ILIKE '%إيماكس%' OR wt.name ILIKE '%ايماكس%' OR wt.name ILIKE '%كاد%' OR wt.name ILIKE '%emax%' OR wt.name ILIKE '%zircon%');

UPDATE public.work_types wt SET category_id = c.id
FROM public.work_type_categories c
WHERE c.lab_id = wt.lab_id AND c.name = 'بورسلين' AND wt.category_id IS NULL
  AND (wt.name ILIKE '%بورسلين%' OR wt.name ILIKE '%معدن%' OR wt.name ILIKE '%vm%' OR wt.name ILIKE '%pfm%' OR wt.name ILIKE '%فينير%' OR wt.name ILIKE '%جسر%');

UPDATE public.work_types wt SET category_id = c.id
FROM public.work_type_categories c
WHERE c.lab_id = wt.lab_id AND c.name = 'أكريل' AND wt.category_id IS NULL
  AND (wt.name ILIKE '%أكريل%' OR wt.name ILIKE '%اكريل%' OR wt.name ILIKE '%فلاكس%' OR wt.name ILIKE '%طقم%');

UPDATE public.work_types wt SET category_id = c.id
FROM public.work_type_categories c
WHERE c.lab_id = wt.lab_id AND c.name = 'تقويم/أجهزة' AND wt.category_id IS NULL
  AND (wt.name ILIKE '%تقويم%' OR wt.name ILIKE '%واقي%' OR wt.name ILIKE '%splint%' OR wt.name ILIKE '%جهاز%');

UPDATE public.work_types wt SET category_id = c.id
FROM public.work_type_categories c
WHERE c.lab_id = wt.lab_id AND c.name = 'أخرى' AND wt.category_id IS NULL;

-- 5) Update bootstrap_new_user_lab to also seed categories for new labs
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

  -- Seed categories
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

  -- Seed work types with categories
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