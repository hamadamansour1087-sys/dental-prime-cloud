-- 1. Add 'delivery' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'delivery';

-- 2. delivery_routes (خطوط السير)
CREATE TABLE public.delivery_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_delivery_routes_lab ON public.delivery_routes(lab_id);

-- 3. delivery_agents (المندوبون)
CREATE TABLE public.delivery_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  user_id UUID UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  governorates TEXT[] NOT NULL DEFAULT '{}',
  route_id UUID REFERENCES public.delivery_routes(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  portal_password_plain TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_delivery_agents_lab ON public.delivery_agents(lab_id);
CREATE INDEX idx_delivery_agents_user ON public.delivery_agents(user_id);

-- 4. delivery_route_doctors (الأطباء في كل خط سير)
CREATE TABLE public.delivery_route_doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES public.delivery_routes(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(route_id, doctor_id)
);
CREATE INDEX idx_drd_lab ON public.delivery_route_doctors(lab_id);
CREATE INDEX idx_drd_doctor ON public.delivery_route_doctors(doctor_id);

-- 5. case_deliveries (سجل تسليمات الحالات)
CREATE TABLE public.case_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.delivery_agents(id) ON DELETE RESTRICT,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_accuracy DOUBLE PRECISION,
  signature_path TEXT,
  recipient_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_deliveries_lab ON public.case_deliveries(lab_id);
CREATE INDEX idx_case_deliveries_case ON public.case_deliveries(case_id);
CREATE INDEX idx_case_deliveries_agent ON public.case_deliveries(agent_id);

-- 6. pending_payments (سندات قبض معلّقة)
CREATE TABLE public.pending_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
  agent_id UUID NOT NULL REFERENCES public.delivery_agents(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method TEXT,
  reference TEXT,
  notes TEXT,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  approved_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pp_lab ON public.pending_payments(lab_id);
CREATE INDEX idx_pp_doctor ON public.pending_payments(doctor_id);
CREATE INDEX idx_pp_agent ON public.pending_payments(agent_id);
CREATE INDEX idx_pp_status ON public.pending_payments(status);

-- 7. updated_at triggers
CREATE TRIGGER trg_delivery_routes_updated BEFORE UPDATE ON public.delivery_routes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_delivery_agents_updated BEFORE UPDATE ON public.delivery_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pending_payments_updated BEFORE UPDATE ON public.pending_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8. Helper functions for delivery agent context
CREATE OR REPLACE FUNCTION public.current_agent_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.delivery_agents WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_agent_lab_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT lab_id FROM public.delivery_agents WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
$$;

-- Returns true if doctor belongs to current agent's coverage (route OR governorate)
CREATE OR REPLACE FUNCTION public.agent_can_see_doctor(_doctor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.delivery_agents a
    JOIN public.doctors d ON d.id = _doctor_id AND d.lab_id = a.lab_id
    WHERE a.user_id = auth.uid() AND a.is_active = true
      AND (
        EXISTS (
          SELECT 1 FROM public.delivery_route_doctors rd
          WHERE rd.route_id = a.route_id AND rd.doctor_id = _doctor_id
        )
        OR (d.governorate IS NOT NULL AND d.governorate = ANY(a.governorates))
      )
  );
$$;

-- 9. Enable RLS on new tables
ALTER TABLE public.delivery_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_route_doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_payments ENABLE ROW LEVEL SECURITY;

-- delivery_routes policies
CREATE POLICY "lab members read routes" ON public.delivery_routes
  FOR SELECT USING (is_lab_member(lab_id) OR lab_id = current_agent_lab_id());
CREATE POLICY "managers manage routes" ON public.delivery_routes
  FOR ALL USING (is_lab_manager_or_admin(lab_id)) WITH CHECK (is_lab_manager_or_admin(lab_id));

-- delivery_agents policies
CREATE POLICY "lab members read agents" ON public.delivery_agents
  FOR SELECT USING (is_lab_member(lab_id));
CREATE POLICY "agent reads own row" ON public.delivery_agents
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "managers manage agents" ON public.delivery_agents
  FOR ALL USING (is_lab_manager_or_admin(lab_id)) WITH CHECK (is_lab_manager_or_admin(lab_id));

-- delivery_route_doctors policies
CREATE POLICY "lab members read rd" ON public.delivery_route_doctors
  FOR SELECT USING (is_lab_member(lab_id) OR lab_id = current_agent_lab_id());
CREATE POLICY "managers manage rd" ON public.delivery_route_doctors
  FOR ALL USING (is_lab_manager_or_admin(lab_id)) WITH CHECK (is_lab_manager_or_admin(lab_id));

-- case_deliveries policies
CREATE POLICY "lab members read deliveries" ON public.case_deliveries
  FOR SELECT USING (is_lab_member(lab_id));
CREATE POLICY "agent reads own deliveries" ON public.case_deliveries
  FOR SELECT USING (agent_id = current_agent_id());
CREATE POLICY "agent inserts own deliveries" ON public.case_deliveries
  FOR INSERT WITH CHECK (
    agent_id = current_agent_id()
    AND lab_id = current_agent_lab_id()
    AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_id AND c.lab_id = current_agent_lab_id()
        AND agent_can_see_doctor(c.doctor_id)
    )
  );
CREATE POLICY "managers delete deliveries" ON public.case_deliveries
  FOR DELETE USING (is_lab_manager_or_admin(lab_id));

-- pending_payments policies
CREATE POLICY "lab members read pp" ON public.pending_payments
  FOR SELECT USING (is_lab_member(lab_id));
CREATE POLICY "agent reads own pp" ON public.pending_payments
  FOR SELECT USING (agent_id = current_agent_id());
CREATE POLICY "agent inserts own pp" ON public.pending_payments
  FOR INSERT WITH CHECK (
    agent_id = current_agent_id()
    AND lab_id = current_agent_lab_id()
    AND status = 'pending'
    AND agent_can_see_doctor(doctor_id)
  );
CREATE POLICY "managers update pp" ON public.pending_payments
  FOR UPDATE USING (is_lab_manager_or_admin(lab_id));
CREATE POLICY "managers delete pp" ON public.pending_payments
  FOR DELETE USING (is_lab_manager_or_admin(lab_id));

-- 10. RPC: approve_pending_payment — moves to payments table atomically
CREATE OR REPLACE FUNCTION public.approve_pending_payment(_pp_id UUID, _cash_account_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_pp RECORD; v_payment_id UUID;
BEGIN
  SELECT * INTO v_pp FROM public.pending_payments WHERE id = _pp_id;
  IF v_pp.id IS NULL THEN RAISE EXCEPTION 'Pending payment not found'; END IF;
  IF NOT public.is_lab_manager_or_admin(v_pp.lab_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_pp.status <> 'pending' THEN RAISE EXCEPTION 'Already reviewed'; END IF;

  INSERT INTO public.payments (lab_id, doctor_id, amount, method, reference, notes, payment_date, cash_account_id, created_by)
  VALUES (v_pp.lab_id, v_pp.doctor_id, v_pp.amount, v_pp.method,
          COALESCE(v_pp.reference, 'سند مندوب #' || substring(v_pp.id::text, 1, 8)),
          v_pp.notes, v_pp.collected_at::date, _cash_account_id, auth.uid())
  RETURNING id INTO v_payment_id;

  UPDATE public.pending_payments
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), approved_payment_id = v_payment_id
  WHERE id = _pp_id;

  INSERT INTO public.audit_log (lab_id, user_id, entity_type, entity_id, action, details)
  VALUES (v_pp.lab_id, auth.uid(), 'pending_payment', _pp_id, 'approved',
    jsonb_build_object('amount', v_pp.amount, 'doctor_id', v_pp.doctor_id, 'payment_id', v_payment_id));

  RETURN v_payment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_pending_payment(_pp_id UUID, _reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_pp RECORD;
BEGIN
  SELECT * INTO v_pp FROM public.pending_payments WHERE id = _pp_id;
  IF v_pp.id IS NULL THEN RAISE EXCEPTION 'Pending payment not found'; END IF;
  IF NOT public.is_lab_manager_or_admin(v_pp.lab_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_pp.status <> 'pending' THEN RAISE EXCEPTION 'Already reviewed'; END IF;

  UPDATE public.pending_payments
  SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = _reason
  WHERE id = _pp_id;

  INSERT INTO public.audit_log (lab_id, user_id, entity_type, entity_id, action, details)
  VALUES (v_pp.lab_id, auth.uid(), 'pending_payment', _pp_id, 'rejected',
    jsonb_build_object('reason', _reason, 'amount', v_pp.amount));
END;
$$;

-- 11. RPC: deliver_case — atomic case delivery
CREATE OR REPLACE FUNCTION public.deliver_case_by_agent(
  _case_id UUID,
  _latitude DOUBLE PRECISION DEFAULT NULL,
  _longitude DOUBLE PRECISION DEFAULT NULL,
  _accuracy DOUBLE PRECISION DEFAULT NULL,
  _signature_path TEXT DEFAULT NULL,
  _recipient_name TEXT DEFAULT NULL,
  _notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_agent_id UUID := public.current_agent_id();
  v_lab_id UUID := public.current_agent_lab_id();
  v_case RECORD;
  v_end_stage UUID;
  v_delivery_id UUID;
BEGIN
  IF v_agent_id IS NULL THEN RAISE EXCEPTION 'Not a delivery agent'; END IF;

  SELECT * INTO v_case FROM public.cases WHERE id = _case_id AND lab_id = v_lab_id;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'Case not found'; END IF;
  IF NOT public.agent_can_see_doctor(v_case.doctor_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  -- Insert delivery record
  INSERT INTO public.case_deliveries (lab_id, case_id, agent_id, latitude, longitude,
    location_accuracy, signature_path, recipient_name, notes)
  VALUES (v_lab_id, _case_id, v_agent_id, _latitude, _longitude,
    _accuracy, _signature_path, _recipient_name, _notes)
  RETURNING id INTO v_delivery_id;

  -- Move case to end stage (delivered)
  SELECT id INTO v_end_stage FROM public.workflow_stages
   WHERE workflow_id = v_case.workflow_id AND is_end = true LIMIT 1;

  UPDATE public.case_stage_history
    SET exited_at = now(),
        duration_minutes = GREATEST(EXTRACT(EPOCH FROM (now() - entered_at))::INTEGER / 60, 0)
    WHERE case_id = _case_id AND exited_at IS NULL;

  IF v_end_stage IS NOT NULL THEN
    INSERT INTO public.case_stage_history (case_id, lab_id, stage_id, entered_by, notes, entered_at)
    VALUES (_case_id, v_lab_id, v_end_stage, auth.uid(),
      'تم التسليم بواسطة المندوب' || COALESCE(' — ' || _notes, ''), now());
  END IF;

  UPDATE public.cases
    SET status = 'delivered'::public.case_status,
        date_delivered = now(),
        current_stage_id = COALESCE(v_end_stage, current_stage_id),
        stage_entered_at = now()
    WHERE id = _case_id;

  INSERT INTO public.audit_log (lab_id, user_id, entity_type, entity_id, action, details)
  VALUES (v_lab_id, auth.uid(), 'case', _case_id, 'delivered_by_agent',
    jsonb_build_object('agent_id', v_agent_id, 'delivery_id', v_delivery_id,
      'lat', _latitude, 'lng', _longitude));

  RETURN v_delivery_id;
END;
$$;

-- 12. Storage bucket for signatures
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-signatures', 'delivery-signatures', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "agents upload signatures" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'delivery-signatures'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = current_agent_lab_id()::text
  );

CREATE POLICY "lab members read signatures" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'delivery-signatures'
    AND (
      is_lab_member((storage.foldername(name))[1]::uuid)
      OR (storage.foldername(name))[1] = current_agent_lab_id()::text
    )
  );