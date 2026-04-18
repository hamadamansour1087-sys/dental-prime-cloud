
-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'technician');
CREATE TYPE public.case_status AS ENUM ('active', 'on_hold', 'delivered', 'cancelled');

-- =========================================
-- HELPER: updated_at trigger
-- =========================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- =========================================
-- LABS
-- =========================================
CREATE TABLE public.labs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  phone TEXT,
  email TEXT,
  address TEXT,
  logo_url TEXT,
  currency TEXT NOT NULL DEFAULT 'EGP',
  timezone TEXT NOT NULL DEFAULT 'Africa/Cairo',
  case_number_prefix TEXT NOT NULL DEFAULT 'C',
  case_number_seq INTEGER NOT NULL DEFAULT 0,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_labs_updated BEFORE UPDATE ON public.labs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.labs ENABLE ROW LEVEL SECURITY;

-- =========================================
-- PROFILES
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lab_id UUID REFERENCES public.labs(id) ON DELETE SET NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_lab_id ON public.profiles(lab_id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================
-- USER ROLES (separate table — security best practice)
-- =========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, lab_id, role)
);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_lab ON public.user_roles(lab_id);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =========================================
-- SECURITY DEFINER HELPERS (avoid recursive RLS)
-- =========================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _lab_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND lab_id = _lab_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.current_lab_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lab_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_lab_member(_lab_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lab_id = _lab_id);
$$;

CREATE OR REPLACE FUNCTION public.is_lab_admin(_lab_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND lab_id = _lab_id AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_lab_manager_or_admin(_lab_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND lab_id = _lab_id AND role IN ('admin','manager'));
$$;

-- =========================================
-- PERMISSIONS, ROLES, ROLE_PERMISSIONS (custom RBAC layer)
-- =========================================
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  UNIQUE(module, action)
);
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id UUID REFERENCES public.labs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_roles_lab ON public.roles(lab_id);
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY(role_id, permission_id)
);
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- =========================================
-- WORK TYPES
-- =========================================
CREATE TABLE public.work_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_price NUMERIC(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_work_types_lab ON public.work_types(lab_id);
ALTER TABLE public.work_types ENABLE ROW LEVEL SECURITY;

-- =========================================
-- DOCTORS
-- =========================================
CREATE TABLE public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  clinic_name TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_doctors_lab ON public.doctors(lab_id);
CREATE INDEX idx_doctors_name ON public.doctors(lab_id, name);
CREATE TRIGGER trg_doctors_updated BEFORE UPDATE ON public.doctors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

-- =========================================
-- PATIENTS
-- =========================================
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  age INTEGER,
  gender TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_patients_lab ON public.patients(lab_id);
CREATE INDEX idx_patients_name ON public.patients(lab_id, name);
CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- =========================================
-- WORKFLOWS
-- =========================================
CREATE TABLE public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_workflows_lab ON public.workflows(lab_id);
CREATE TRIGGER trg_workflows_updated BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workflow_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6B7280',
  order_index INTEGER NOT NULL,
  estimated_days INTEGER,
  is_start BOOLEAN NOT NULL DEFAULT false,
  is_end BOOLEAN NOT NULL DEFAULT false,
  notify_doctor BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, code)
);
CREATE INDEX idx_workflow_stages_workflow ON public.workflow_stages(workflow_id);
CREATE INDEX idx_workflow_stages_lab ON public.workflow_stages(lab_id);
ALTER TABLE public.workflow_stages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workflow_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  from_stage_id UUID NOT NULL REFERENCES public.workflow_stages(id) ON DELETE CASCADE,
  to_stage_id UUID NOT NULL REFERENCES public.workflow_stages(id) ON DELETE CASCADE,
  UNIQUE(workflow_id, from_stage_id, to_stage_id)
);
CREATE INDEX idx_workflow_transitions_lab ON public.workflow_transitions(lab_id);
ALTER TABLE public.workflow_transitions ENABLE ROW LEVEL SECURITY;

-- =========================================
-- CASES
-- =========================================
CREATE TABLE public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  case_number TEXT NOT NULL,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  work_type_id UUID REFERENCES public.work_types(id) ON DELETE SET NULL,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE SET NULL,
  current_stage_id UUID REFERENCES public.workflow_stages(id) ON DELETE SET NULL,
  shade TEXT,
  tooth_numbers TEXT,
  units INTEGER DEFAULT 1,
  notes TEXT,
  price NUMERIC(10,2),
  status public.case_status NOT NULL DEFAULT 'active',
  date_received DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  date_delivered TIMESTAMPTZ,
  stage_entered_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lab_id, case_number)
);
CREATE INDEX idx_cases_lab ON public.cases(lab_id);
CREATE INDEX idx_cases_doctor ON public.cases(doctor_id);
CREATE INDEX idx_cases_stage ON public.cases(current_stage_id);
CREATE INDEX idx_cases_status ON public.cases(lab_id, status);
CREATE INDEX idx_cases_due ON public.cases(lab_id, due_date) WHERE status = 'active';
CREATE TRIGGER trg_cases_updated BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.case_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_attachments_case ON public.case_attachments(case_id);
CREATE INDEX idx_case_attachments_lab ON public.case_attachments(lab_id);
ALTER TABLE public.case_attachments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.case_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.workflow_stages(id) ON DELETE SET NULL,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  exited_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  entered_by UUID REFERENCES auth.users(id),
  notes TEXT
);
CREATE INDEX idx_csh_case ON public.case_stage_history(case_id);
CREATE INDEX idx_csh_lab ON public.case_stage_history(lab_id);
ALTER TABLE public.case_stage_history ENABLE ROW LEVEL SECURITY;

-- =========================================
-- AUDIT LOG
-- =========================================
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_lab ON public.audit_log(lab_id, created_at DESC);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- =========================================
-- RLS POLICIES
-- =========================================

-- LABS
CREATE POLICY "members read own lab" ON public.labs FOR SELECT USING (public.is_lab_member(id));
CREATE POLICY "admins update own lab" ON public.labs FOR UPDATE USING (public.is_lab_admin(id));
-- Insert handled by signup trigger (security definer)

-- PROFILES
CREATE POLICY "user reads own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "lab admins read lab profiles" ON public.profiles FOR SELECT USING (lab_id IS NOT NULL AND public.is_lab_admin(lab_id));
CREATE POLICY "lab members read lab profiles" ON public.profiles FOR SELECT USING (lab_id IS NOT NULL AND public.is_lab_member(lab_id));
CREATE POLICY "user updates own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "user inserts own profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());

-- USER_ROLES
CREATE POLICY "members read lab roles" ON public.user_roles FOR SELECT USING (public.is_lab_member(lab_id));
CREATE POLICY "admins manage user_roles" ON public.user_roles FOR ALL USING (public.is_lab_admin(lab_id)) WITH CHECK (public.is_lab_admin(lab_id));

-- PERMISSIONS (global, read-only to authenticated)
CREATE POLICY "auth read permissions" ON public.permissions FOR SELECT USING (auth.uid() IS NOT NULL);

-- ROLES
CREATE POLICY "members read lab roles_table" ON public.roles FOR SELECT USING (lab_id IS NULL OR public.is_lab_member(lab_id));
CREATE POLICY "admins manage lab roles_table" ON public.roles FOR ALL USING (lab_id IS NOT NULL AND public.is_lab_admin(lab_id)) WITH CHECK (lab_id IS NOT NULL AND public.is_lab_admin(lab_id));

-- ROLE_PERMISSIONS
CREATE POLICY "members read role_permissions" ON public.role_permissions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_id AND (r.lab_id IS NULL OR public.is_lab_member(r.lab_id)))
);
CREATE POLICY "admins manage role_permissions" ON public.role_permissions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_id AND r.lab_id IS NOT NULL AND public.is_lab_admin(r.lab_id))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_id AND r.lab_id IS NOT NULL AND public.is_lab_admin(r.lab_id))
);

-- WORK TYPES
CREATE POLICY "lab members read work_types" ON public.work_types FOR SELECT USING (public.is_lab_member(lab_id));
CREATE POLICY "lab admins manage work_types" ON public.work_types FOR ALL USING (public.is_lab_admin(lab_id)) WITH CHECK (public.is_lab_admin(lab_id));

-- DOCTORS
CREATE POLICY "lab members read doctors" ON public.doctors FOR SELECT USING (public.is_lab_member(lab_id));
CREATE POLICY "lab members insert doctors" ON public.doctors FOR INSERT WITH CHECK (public.is_lab_member(lab_id));
CREATE POLICY "lab members update doctors" ON public.doctors FOR UPDATE USING (public.is_lab_member(lab_id));
CREATE POLICY "managers delete doctors" ON public.doctors FOR DELETE USING (public.is_lab_manager_or_admin(lab_id));

-- PATIENTS
CREATE POLICY "lab members read patients" ON public.patients FOR SELECT USING (public.is_lab_member(lab_id));
CREATE POLICY "lab members insert patients" ON public.patients FOR INSERT WITH CHECK (public.is_lab_member(lab_id));
CREATE POLICY "lab members update patients" ON public.patients FOR UPDATE USING (public.is_lab_member(lab_id));
CREATE POLICY "managers delete patients" ON public.patients FOR DELETE USING (public.is_lab_manager_or_admin(lab_id));

-- WORKFLOWS
CREATE POLICY "lab members read workflows" ON public.workflows FOR SELECT USING (public.is_lab_member(lab_id));
CREATE POLICY "lab admins manage workflows" ON public.workflows FOR ALL USING (public.is_lab_admin(lab_id)) WITH CHECK (public.is_lab_admin(lab_id));

CREATE POLICY "lab members read stages" ON public.workflow_stages FOR SELECT USING (public.is_lab_member(lab_id));
CREATE POLICY "lab admins manage stages" ON public.workflow_stages FOR ALL USING (public.is_lab_admin(lab_id)) WITH CHECK (public.is_lab_admin(lab_id));

CREATE POLICY "lab members read transitions" ON public.workflow_transitions FOR SELECT USING (public.is_lab_member(lab_id));
CREATE POLICY "lab admins manage transitions" ON public.workflow_transitions FOR ALL USING (public.is_lab_admin(lab_id)) WITH CHECK (public.is_lab_admin(lab_id));

-- CASES
CREATE POLICY "lab members read cases" ON public.cases FOR SELECT USING (public.is_lab_member(lab_id));
CREATE POLICY "lab members insert cases" ON public.cases FOR INSERT WITH CHECK (public.is_lab_member(lab_id));
CREATE POLICY "lab members update cases" ON public.cases FOR UPDATE USING (public.is_lab_member(lab_id));
CREATE POLICY "managers delete cases" ON public.cases FOR DELETE USING (public.is_lab_manager_or_admin(lab_id));

-- CASE ATTACHMENTS
CREATE POLICY "lab members read attachments" ON public.case_attachments FOR SELECT USING (public.is_lab_member(lab_id));
CREATE POLICY "lab members insert attachments" ON public.case_attachments FOR INSERT WITH CHECK (public.is_lab_member(lab_id));
CREATE POLICY "lab members delete attachments" ON public.case_attachments FOR DELETE USING (public.is_lab_member(lab_id));

-- STAGE HISTORY
CREATE POLICY "lab members read stage_history" ON public.case_stage_history FOR SELECT USING (public.is_lab_member(lab_id));
CREATE POLICY "lab members insert stage_history" ON public.case_stage_history FOR INSERT WITH CHECK (public.is_lab_member(lab_id));
CREATE POLICY "lab members update stage_history" ON public.case_stage_history FOR UPDATE USING (public.is_lab_member(lab_id));

-- AUDIT LOG
CREATE POLICY "managers read audit" ON public.audit_log FOR SELECT USING (public.is_lab_manager_or_admin(lab_id));
CREATE POLICY "lab members insert audit" ON public.audit_log FOR INSERT WITH CHECK (public.is_lab_member(lab_id));

-- =========================================
-- SEED DEFAULT PERMISSIONS (global)
-- =========================================
INSERT INTO public.permissions (module, action, name_ar, name_en) VALUES
  ('cases','view','عرض الحالات','View Cases'),
  ('cases','create','إنشاء حالة','Create Case'),
  ('cases','edit','تعديل حالة','Edit Case'),
  ('cases','delete','حذف حالة','Delete Case'),
  ('cases','change_stage','تغيير مرحلة','Change Stage'),
  ('doctors','view','عرض الأطباء','View Doctors'),
  ('doctors','create','إضافة طبيب','Create Doctor'),
  ('doctors','edit','تعديل طبيب','Edit Doctor'),
  ('doctors','delete','حذف طبيب','Delete Doctor'),
  ('patients','view','عرض المرضى','View Patients'),
  ('patients','create','إضافة مريض','Create Patient'),
  ('patients','edit','تعديل مريض','Edit Patient'),
  ('patients','delete','حذف مريض','Delete Patient'),
  ('workflows','view','عرض سير العمل','View Workflows'),
  ('workflows','manage','إدارة سير العمل','Manage Workflows'),
  ('users','view','عرض المستخدمين','View Users'),
  ('users','manage','إدارة المستخدمين','Manage Users'),
  ('settings','view','عرض الإعدادات','View Settings'),
  ('settings','manage','إدارة الإعدادات','Manage Settings'),
  ('reports','view','عرض التقارير','View Reports');

-- =========================================
-- BOOTSTRAP NEW USER + LAB
-- =========================================
CREATE OR REPLACE FUNCTION public.bootstrap_new_user_lab()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lab_id UUID;
  v_workflow_id UUID;
  v_stage RECORD;
  v_role_admin UUID;
  v_role_manager UUID;
  v_role_tech UUID;
  v_lab_name TEXT;
  v_full_name TEXT;
BEGIN
  v_lab_name := COALESCE(NEW.raw_user_meta_data->>'lab_name', 'معملي');
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);

  -- 1. Create lab
  INSERT INTO public.labs (name, code)
  VALUES (v_lab_name, 'LAB-' || substring(NEW.id::text, 1, 8))
  RETURNING id INTO v_lab_id;

  -- 2. Create profile
  INSERT INTO public.profiles (id, lab_id, full_name)
  VALUES (NEW.id, v_lab_id, v_full_name);

  -- 3. Assign admin role
  INSERT INTO public.user_roles (user_id, lab_id, role) VALUES (NEW.id, v_lab_id, 'admin');

  -- 4. Seed default RBAC roles for the lab
  INSERT INTO public.roles (lab_id, name, description, is_system) VALUES
    (v_lab_id, 'مدير', 'مدير المعمل - كل الصلاحيات', true) RETURNING id INTO v_role_admin;
  INSERT INTO public.roles (lab_id, name, description, is_system) VALUES
    (v_lab_id, 'مشرف', 'مشرف الإنتاج', true) RETURNING id INTO v_role_manager;
  INSERT INTO public.roles (lab_id, name, description, is_system) VALUES
    (v_lab_id, 'فني', 'فني تركيبات', true) RETURNING id INTO v_role_tech;

  -- Admin gets all perms
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_admin, id FROM public.permissions;

  -- Manager: most perms except user/settings management
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_manager, id FROM public.permissions
  WHERE NOT (module IN ('users','settings') AND action = 'manage');

  -- Technician: view + change stage
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_tech, id FROM public.permissions
  WHERE action IN ('view','change_stage');

  -- 5. Seed default work types
  INSERT INTO public.work_types (lab_id, name) VALUES
    (v_lab_id, 'تاج زيركون'),
    (v_lab_id, 'تاج بورسلين فيوزد ميتال'),
    (v_lab_id, 'جسر ٣ وحدات'),
    (v_lab_id, 'فينير'),
    (v_lab_id, 'طقم كامل'),
    (v_lab_id, 'طقم متحرك جزئي');

  -- 6. Seed default workflow
  INSERT INTO public.workflows (lab_id, name, is_default)
  VALUES (v_lab_id, 'سير العمل الافتراضي', true)
  RETURNING id INTO v_workflow_id;

  INSERT INTO public.workflow_stages (workflow_id, lab_id, name, code, color, order_index, estimated_days, is_start, is_end, notify_doctor) VALUES
    (v_workflow_id, v_lab_id, 'استلام', 'received', '#3B82F6', 1, 0, true, false, false),
    (v_workflow_id, v_lab_id, 'طبعة', 'impression', '#8B5CF6', 2, 1, false, false, false),
    (v_workflow_id, v_lab_id, 'معدن', 'metal', '#EC4899', 3, 2, false, false, false),
    (v_workflow_id, v_lab_id, 'بورسلين', 'porcelain', '#F59E0B', 4, 2, false, false, false),
    (v_workflow_id, v_lab_id, 'تشطيب', 'finishing', '#10B981', 5, 1, false, false, false),
    (v_workflow_id, v_lab_id, 'جاهز للتسليم', 'ready', '#06B6D4', 6, 0, false, false, true),
    (v_workflow_id, v_lab_id, 'تم التسليم', 'delivered', '#059669', 7, 0, false, true, false);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_new_user_lab();

-- =========================================
-- CASE NUMBER GENERATION
-- =========================================
CREATE OR REPLACE FUNCTION public.generate_case_number(_lab_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prefix TEXT;
  v_seq INTEGER;
BEGIN
  UPDATE public.labs
  SET case_number_seq = case_number_seq + 1
  WHERE id = _lab_id
  RETURNING case_number_prefix, case_number_seq INTO v_prefix, v_seq;
  RETURN v_prefix || '-' || LPAD(v_seq::text, 5, '0');
END;
$$;

-- =========================================
-- STAGE TRANSITION HELPER
-- =========================================
CREATE OR REPLACE FUNCTION public.transition_case_stage(_case_id UUID, _to_stage_id UUID, _notes TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_case RECORD;
  v_to_stage RECORD;
BEGIN
  SELECT * INTO v_case FROM public.cases WHERE id = _case_id;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'Case not found'; END IF;
  IF NOT public.is_lab_member(v_case.lab_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT * INTO v_to_stage FROM public.workflow_stages WHERE id = _to_stage_id;
  IF v_to_stage.lab_id <> v_case.lab_id THEN RAISE EXCEPTION 'Stage not in same lab'; END IF;

  -- Close current history record
  UPDATE public.case_stage_history
    SET exited_at = now(),
        duration_minutes = EXTRACT(EPOCH FROM (now() - entered_at))::INTEGER / 60
    WHERE case_id = _case_id AND exited_at IS NULL;

  -- Insert new history
  INSERT INTO public.case_stage_history (case_id, lab_id, stage_id, entered_by, notes)
  VALUES (_case_id, v_case.lab_id, _to_stage_id, auth.uid(), _notes);

  -- Update case
  UPDATE public.cases
    SET current_stage_id = _to_stage_id,
        stage_entered_at = now(),
        status = CASE WHEN v_to_stage.is_end THEN 'delivered'::public.case_status ELSE status END,
        date_delivered = CASE WHEN v_to_stage.is_end THEN now() ELSE date_delivered END
    WHERE id = _case_id;

  -- Audit
  INSERT INTO public.audit_log (lab_id, user_id, entity_type, entity_id, action, details)
  VALUES (v_case.lab_id, auth.uid(), 'case', _case_id, 'stage_changed',
          jsonb_build_object('to_stage_id', _to_stage_id, 'notes', _notes));
END;
$$;

-- =========================================
-- STORAGE BUCKET
-- =========================================
INSERT INTO storage.buckets (id, name, public) VALUES ('case-attachments', 'case-attachments', false);

CREATE POLICY "lab members read case files" ON storage.objects FOR SELECT
  USING (bucket_id = 'case-attachments' AND public.is_lab_member((storage.foldername(name))[1]::uuid));
CREATE POLICY "lab members upload case files" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'case-attachments' AND public.is_lab_member((storage.foldername(name))[1]::uuid));
CREATE POLICY "lab members delete case files" ON storage.objects FOR DELETE
  USING (bucket_id = 'case-attachments' AND public.is_lab_member((storage.foldername(name))[1]::uuid));
