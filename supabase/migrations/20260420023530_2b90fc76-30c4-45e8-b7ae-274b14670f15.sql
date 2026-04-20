
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT,
  reference TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_doctor_date ON public.payments(doctor_id, payment_date);
CREATE INDEX idx_payments_lab ON public.payments(lab_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lab members read payments" ON public.payments
  FOR SELECT USING (public.is_lab_member(lab_id));

CREATE POLICY "lab members insert payments" ON public.payments
  FOR INSERT WITH CHECK (public.is_lab_member(lab_id));

CREATE POLICY "lab members update payments" ON public.payments
  FOR UPDATE USING (public.is_lab_member(lab_id));

CREATE POLICY "managers delete payments" ON public.payments
  FOR DELETE USING (public.is_lab_manager_or_admin(lab_id));

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
