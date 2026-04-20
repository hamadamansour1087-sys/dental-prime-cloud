-- 1. Price lists table (special prices)
CREATE TABLE public.price_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  work_type_id UUID NOT NULL REFERENCES public.work_types(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE,
  governorate TEXT,
  price NUMERIC NOT NULL CHECK (price >= 0),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Must be either doctor-specific or governorate-specific (not both, not neither)
  CONSTRAINT price_scope_check CHECK (
    (doctor_id IS NOT NULL AND governorate IS NULL) OR
    (doctor_id IS NULL AND governorate IS NOT NULL)
  )
);

CREATE INDEX idx_price_lists_lookup ON public.price_lists(lab_id, work_type_id, doctor_id, governorate) WHERE is_active = true;
CREATE UNIQUE INDEX idx_price_lists_doctor_uniq ON public.price_lists(lab_id, work_type_id, doctor_id) WHERE doctor_id IS NOT NULL;
CREATE UNIQUE INDEX idx_price_lists_gov_uniq ON public.price_lists(lab_id, work_type_id, governorate) WHERE governorate IS NOT NULL;

ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lab members read price_lists" ON public.price_lists
  FOR SELECT USING (public.is_lab_member(lab_id));
CREATE POLICY "managers insert price_lists" ON public.price_lists
  FOR INSERT WITH CHECK (public.is_lab_manager_or_admin(lab_id));
CREATE POLICY "managers update price_lists" ON public.price_lists
  FOR UPDATE USING (public.is_lab_manager_or_admin(lab_id));
CREATE POLICY "managers delete price_lists" ON public.price_lists
  FOR DELETE USING (public.is_lab_manager_or_admin(lab_id));

CREATE TRIGGER trg_price_lists_updated
  BEFORE UPDATE ON public.price_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Resolve price function (priority: doctor > governorate > general)
CREATE OR REPLACE FUNCTION public.resolve_case_price(
  _lab_id UUID,
  _work_type_id UUID,
  _doctor_id UUID
) RETURNS NUMERIC
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price NUMERIC;
  v_governorate TEXT;
BEGIN
  IF _work_type_id IS NULL THEN RETURN NULL; END IF;

  -- 1) Doctor-specific price
  IF _doctor_id IS NOT NULL THEN
    SELECT price INTO v_price FROM public.price_lists
    WHERE lab_id = _lab_id AND work_type_id = _work_type_id
      AND doctor_id = _doctor_id AND is_active = true
    LIMIT 1;
    IF v_price IS NOT NULL THEN RETURN v_price; END IF;

    -- 2) Governorate-specific price
    SELECT governorate INTO v_governorate FROM public.doctors WHERE id = _doctor_id;
    IF v_governorate IS NOT NULL THEN
      SELECT price INTO v_price FROM public.price_lists
      WHERE lab_id = _lab_id AND work_type_id = _work_type_id
        AND governorate = v_governorate AND is_active = true
      LIMIT 1;
      IF v_price IS NOT NULL THEN RETURN v_price; END IF;
    END IF;
  END IF;

  -- 3) General price from work_types
  SELECT default_price INTO v_price FROM public.work_types
  WHERE id = _work_type_id AND lab_id = _lab_id;
  RETURN v_price;
END;
$$;

-- 3. Auto-set price on case insert if not provided
CREATE OR REPLACE FUNCTION public.cases_auto_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.price IS NULL AND NEW.work_type_id IS NOT NULL THEN
    NEW.price := public.resolve_case_price(NEW.lab_id, NEW.work_type_id, NEW.doctor_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cases_auto_price
  BEFORE INSERT ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.cases_auto_price();