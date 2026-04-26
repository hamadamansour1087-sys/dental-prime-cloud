
-- Fix delivery-signatures storage policy
-- Old policy required first folder = lab_id, but the app uploads at caseId/timestamp.png
DROP POLICY IF EXISTS "agents upload signatures" ON storage.objects;
DROP POLICY IF EXISTS "lab members read signatures" ON storage.objects;

CREATE POLICY "agents upload signatures"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-signatures'
  AND public.current_agent_id() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.lab_id = public.current_agent_lab_id()
      AND public.agent_can_see_doctor(c.doctor_id)
  )
);

CREATE POLICY "lab members read signatures"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-signatures'
  AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (
        public.is_lab_member(c.lab_id)
        OR (c.lab_id = public.current_agent_lab_id() AND public.agent_can_see_doctor(c.doctor_id))
      )
  )
);

-- Daily summary RPC for delivery agents
CREATE OR REPLACE FUNCTION public.agent_daily_summary(_date date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id uuid := public.current_agent_id();
  v_lab_id uuid := public.current_agent_lab_id();
  v_delivered_count int := 0;
  v_payments_count int := 0;
  v_payments_total numeric := 0;
  v_pending_ready int := 0;
  v_doctor_ids uuid[];
BEGIN
  IF v_agent_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not an agent');
  END IF;

  SELECT COUNT(*) INTO v_delivered_count
  FROM public.case_deliveries
  WHERE agent_id = v_agent_id
    AND delivered_at::date = _date;

  SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO v_payments_count, v_payments_total
  FROM public.pending_payments
  WHERE agent_id = v_agent_id
    AND collected_at::date = _date;

  -- Count ready cases assigned to this agent
  SELECT COALESCE(array_agg(DISTINCT d.id), '{}') INTO v_doctor_ids
  FROM public.doctors d
  LEFT JOIN public.delivery_route_doctors rd ON rd.doctor_id = d.id
  LEFT JOIN public.delivery_agents a ON a.id = v_agent_id
  WHERE d.lab_id = v_lab_id
    AND (
      (a.route_id IS NOT NULL AND rd.route_id = a.route_id)
      OR (d.governorate = ANY(a.governorates))
    );

  IF array_length(v_doctor_ids, 1) > 0 THEN
    SELECT COUNT(*) INTO v_pending_ready
    FROM public.cases c
    JOIN public.workflow_stages ws ON ws.id = c.current_stage_id
    WHERE c.lab_id = v_lab_id
      AND c.status = 'active'
      AND c.doctor_id = ANY(v_doctor_ids)
      AND ws.code = 'ready';
  END IF;

  RETURN jsonb_build_object(
    'date', _date,
    'delivered_count', v_delivered_count,
    'payments_count', v_payments_count,
    'payments_total', v_payments_total,
    'pending_ready', v_pending_ready
  );
END;
$$;
