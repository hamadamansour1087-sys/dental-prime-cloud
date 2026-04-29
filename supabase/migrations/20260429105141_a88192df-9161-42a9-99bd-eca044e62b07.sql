-- Re-grant EXECUTE on helper functions used inside RLS policies.
-- These must be callable by authenticated users (RLS evaluates them in the user's context).
GRANT EXECUTE ON FUNCTION public.is_lab_member(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_lab_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_lab_manager_or_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_lab_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_doctor_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_doctor_lab_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_agent_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_agent_lab_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.agent_can_see_doctor(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.resolve_case_price(uuid, uuid, uuid) TO authenticated, anon;