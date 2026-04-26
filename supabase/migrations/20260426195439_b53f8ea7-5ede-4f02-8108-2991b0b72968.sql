-- 1) Restrict case_stage_history UPDATE to managers/admins only
DROP POLICY IF EXISTS "lab members update stage_history" ON public.case_stage_history;

CREATE POLICY "managers update stage_history"
ON public.case_stage_history
FOR UPDATE
USING (public.is_lab_manager_or_admin(lab_id))
WITH CHECK (public.is_lab_manager_or_admin(lab_id));

-- 2) Audit role changes (especially admin grants) on user_roles
CREATE OR REPLACE FUNCTION public.audit_user_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (lab_id, user_id, entity_type, entity_id, action, details)
    VALUES (
      NEW.lab_id, auth.uid(), 'user_role', NEW.id,
      CASE WHEN NEW.role = 'admin' THEN 'admin_role_granted' ELSE 'role_granted' END,
      jsonb_build_object('target_user_id', NEW.user_id, 'role', NEW.role)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      INSERT INTO public.audit_log (lab_id, user_id, entity_type, entity_id, action, details)
      VALUES (
        NEW.lab_id, auth.uid(), 'user_role', NEW.id, 'role_changed',
        jsonb_build_object('target_user_id', NEW.user_id, 'old_role', OLD.role, 'new_role', NEW.role)
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (lab_id, user_id, entity_type, entity_id, action, details)
    VALUES (
      OLD.lab_id, auth.uid(), 'user_role', OLD.id,
      CASE WHEN OLD.role = 'admin' THEN 'admin_role_revoked' ELSE 'role_revoked' END,
      jsonb_build_object('target_user_id', OLD.user_id, 'role', OLD.role)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_user_role_change ON public.user_roles;
CREATE TRIGGER trg_audit_user_role_change
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_user_role_change();