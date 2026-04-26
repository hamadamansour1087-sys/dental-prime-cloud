DROP POLICY IF EXISTS "agents read assigned doctors" ON public.doctors;
CREATE POLICY "agents read assigned doctors"
ON public.doctors
FOR SELECT
USING (
  lab_id = public.current_agent_lab_id()
  AND public.agent_can_see_doctor(id)
);

DROP POLICY IF EXISTS "agents read assigned cases" ON public.cases;
CREATE POLICY "agents read assigned cases"
ON public.cases
FOR SELECT
USING (
  lab_id = public.current_agent_lab_id()
  AND doctor_id IS NOT NULL
  AND public.agent_can_see_doctor(doctor_id)
);

DROP POLICY IF EXISTS "agents read workflow stages" ON public.workflow_stages;
CREATE POLICY "agents read workflow stages"
ON public.workflow_stages
FOR SELECT
USING (lab_id = public.current_agent_lab_id());

DROP POLICY IF EXISTS "agents read own lab" ON public.labs;
CREATE POLICY "agents read own lab"
ON public.labs
FOR SELECT
USING (id = public.current_agent_lab_id());