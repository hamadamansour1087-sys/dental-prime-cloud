CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID,
  actor_email TEXT,
  lab_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  before_data JSONB,
  after_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_lab ON public.audit_logs(lab_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read all audit logs"
ON public.audit_logs FOR SELECT
USING (public.is_super_admin());

CREATE POLICY "Lab admins can read their lab audit logs"
ON public.audit_logs FOR SELECT
USING (lab_id IS NOT NULL AND public.is_lab_admin(lab_id));

CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);