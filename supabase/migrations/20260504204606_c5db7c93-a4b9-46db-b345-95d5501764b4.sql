
-- Revoke EXECUTE from anon on all public SECURITY DEFINER functions that should not be callable without signing in
REVOKE EXECUTE ON FUNCTION public.agent_can_see_doctor(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_lab_request(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_followup_case(uuid, text, boolean, text, numeric, text, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_agent_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_agent_lab_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_doctor_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_doctor_lab_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_lab_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_lab_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_lab_manager_or_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_lab_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_case_price(uuid, uuid, uuid) FROM anon;

-- Remove the weaker duplicate storage policy on delivery-signatures bucket
DROP POLICY IF EXISTS "agents upload delivery signatures" ON storage.objects;
