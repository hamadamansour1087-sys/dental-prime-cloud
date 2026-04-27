-- Cleanup demo lab data and user
DO $$
DECLARE v_lab uuid := '703a5848-e1b1-4d20-8b2e-edc047f8f2dd';
        v_user uuid := '0a5a48c6-6b4e-40e9-8e0d-25005f79938d';
BEGIN
  DELETE FROM public.case_stage_history WHERE lab_id = v_lab;
  DELETE FROM public.case_deliveries WHERE lab_id = v_lab;
  DELETE FROM public.case_attachments WHERE lab_id = v_lab;
  DELETE FROM public.case_items WHERE lab_id = v_lab;
  DELETE FROM public.pending_payments WHERE lab_id = v_lab;
  DELETE FROM public.payments WHERE lab_id = v_lab;
  DELETE FROM public.cases WHERE lab_id = v_lab;
  DELETE FROM public.portal_messages WHERE lab_id = v_lab;
  DELETE FROM public.patients WHERE lab_id = v_lab;
  DELETE FROM public.doctor_clinics WHERE lab_id = v_lab;
  DELETE FROM public.doctors WHERE lab_id = v_lab;
  DELETE FROM public.delivery_route_doctors WHERE lab_id = v_lab;
  DELETE FROM public.delivery_routes WHERE lab_id = v_lab;
  DELETE FROM public.delivery_agents WHERE lab_id = v_lab;
  DELETE FROM public.technicians WHERE lab_id = v_lab;
  DELETE FROM public.expenses WHERE lab_id = v_lab;
  DELETE FROM public.expense_categories WHERE lab_id = v_lab;
  DELETE FROM public.vouchers WHERE lab_id = v_lab;
  DELETE FROM public.cash_accounts WHERE lab_id = v_lab;
  DELETE FROM public.supplier_payments WHERE lab_id = v_lab;
  DELETE FROM public.purchase_invoice_items WHERE lab_id = v_lab;
  DELETE FROM public.purchase_invoices WHERE lab_id = v_lab;
  DELETE FROM public.suppliers WHERE lab_id = v_lab;
  DELETE FROM public.inventory_movements WHERE lab_id = v_lab;
  DELETE FROM public.inventory_items WHERE lab_id = v_lab;
  DELETE FROM public.price_lists WHERE lab_id = v_lab;
  DELETE FROM public.workflow_stages WHERE lab_id = v_lab;
  DELETE FROM public.workflows WHERE lab_id = v_lab;
  DELETE FROM public.work_types WHERE lab_id = v_lab;
  DELETE FROM public.work_type_categories WHERE lab_id = v_lab;
  DELETE FROM public.role_permissions WHERE role_id IN (SELECT id FROM public.roles WHERE lab_id = v_lab);
  DELETE FROM public.roles WHERE lab_id = v_lab;
  DELETE FROM public.user_roles WHERE lab_id = v_lab;
  DELETE FROM public.profiles WHERE lab_id = v_lab;
  DELETE FROM public.audit_log WHERE lab_id = v_lab;
  DELETE FROM public.labs WHERE id = v_lab;
  DELETE FROM auth.users WHERE id = v_user;
END $$;

-- Backup reminders table (logs daily reminder events for the in-app dialog)
CREATE TABLE IF NOT EXISTS public.backup_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL,
  reminder_date date NOT NULL DEFAULT CURRENT_DATE,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lab_id, reminder_date)
);

ALTER TABLE public.backup_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lab members read backup_reminders"
  ON public.backup_reminders FOR SELECT
  USING (public.is_lab_member(lab_id));

CREATE POLICY "lab members update backup_reminders"
  ON public.backup_reminders FOR UPDATE
  USING (public.is_lab_member(lab_id));

CREATE POLICY "lab members insert backup_reminders"
  ON public.backup_reminders FOR INSERT
  WITH CHECK (public.is_lab_member(lab_id));

-- Daily job: insert one reminder row per active lab at 8 AM Cairo time (06:00 UTC)
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'daily-backup-reminders',
  '0 6 * * *',
  $$
  INSERT INTO public.backup_reminders (lab_id, reminder_date)
  SELECT id, CURRENT_DATE FROM public.labs WHERE is_active = true
  ON CONFLICT (lab_id, reminder_date) DO NOTHING;
  $$
);