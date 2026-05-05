CREATE POLICY "agents read assigned doctor payments"
ON public.payments
FOR SELECT
USING (
  lab_id = public.current_agent_lab_id()
  AND public.agent_can_see_doctor(doctor_id)
);