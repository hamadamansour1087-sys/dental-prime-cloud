
-- 1) Revoke EXECUTE from anon and authenticated on all SECURITY DEFINER functions in public schema.
--    These functions are called internally (from RLS policies, triggers, or other security definer
--    functions). They should NOT be invokable directly from the API by any client.
--    RLS policies continue to work because postgres role still has EXECUTE.

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT n.nspname AS schema_name, p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, authenticated, public',
                   fn.schema_name, fn.function_name, fn.args);
  END LOOP;
END $$;

-- 2) Re-grant EXECUTE on functions that MUST be callable by signed-in users via the API
--    (these are RPC endpoints called from the app, portal, and delivery clients).
GRANT EXECUTE ON FUNCTION public.approve_pending_payment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_pending_payment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deliver_case_by_agent(uuid, double precision, double precision, double precision, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_daily_summary(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_followup_case_from_portal(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_pending_case(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_pending_case(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_case_stage(uuid, uuid, text, uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_case_stage(uuid, uuid, text, uuid, uuid[], timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_followup_case(uuid, text, boolean, text, numeric, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_workflow(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_workflow(uuid, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_workflow(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_default_workflow(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_workflow_stage(uuid, text, text, integer, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_workflow_stage(uuid, text, text, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_workflow_stage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_workflow_stages(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_case_number(uuid) TO authenticated;

-- 3) Lab-logos bucket: keep public read (logos are shown on doctor portal & invoices)
--    but disallow listing the bucket contents. Public read of a known URL is fine;
--    enumeration is not.
--    We do this by ensuring there is no broad SELECT policy that allows listing.
--    Public buckets allow direct URL access regardless of RLS, so we just remove
--    any "list all" SELECT policy if present.
DO $$
BEGIN
  -- Drop any overly-permissive SELECT policies on lab-logos bucket
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public lab logos are listable'
  ) THEN
    DROP POLICY "Public lab logos are listable" ON storage.objects;
  END IF;
END $$;
