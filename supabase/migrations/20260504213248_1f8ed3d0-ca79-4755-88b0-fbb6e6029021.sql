-- Revoke EXECUTE from anon on ALL SECURITY DEFINER functions in public schema
DO $$
DECLARE
  fn_oid oid;
  fn_sig text;
BEGIN
  FOR fn_oid, fn_sig IN
    SELECT p.oid, p.oid::regprocedure::text
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn_sig);
  END LOOP;
END
$$;

-- Also ensure the trigger functions (not callable via RPC) are safe
-- bootstrap_new_user_lab, audit_user_role_change, set_updated_at, cases_auto_price,
-- apply_inventory_movement, portal_messages_guard_update are triggers
-- No additional action needed — they're only called by triggers, not via PostgREST