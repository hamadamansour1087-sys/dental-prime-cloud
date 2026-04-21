-- 1) Case items: multiple work types per case, each with own teeth/shade/price
CREATE TABLE public.case_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  work_type_id UUID REFERENCES public.work_types(id) ON DELETE SET NULL,
  tooth_numbers TEXT,
  shade TEXT,
  units INTEGER NOT NULL DEFAULT 1 CHECK (units > 0),
  unit_price NUMERIC,
  total_price NUMERIC,
  notes TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_case_items_case ON public.case_items(case_id);
CREATE INDEX idx_case_items_lab ON public.case_items(lab_id);

ALTER TABLE public.case_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lab members read case_items" ON public.case_items
  FOR SELECT USING (public.is_lab_member(lab_id));
CREATE POLICY "lab members insert case_items" ON public.case_items
  FOR INSERT WITH CHECK (public.is_lab_member(lab_id));
CREATE POLICY "lab members update case_items" ON public.case_items
  FOR UPDATE USING (public.is_lab_member(lab_id));
CREATE POLICY "lab members delete case_items" ON public.case_items
  FOR DELETE USING (public.is_lab_member(lab_id));

CREATE TRIGGER trg_case_items_updated_at
  BEFORE UPDATE ON public.case_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Add kind column to case_attachments to distinguish photos vs scans
ALTER TABLE public.case_attachments
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'file';
-- values: 'photo' | 'scan' | 'file'

-- 3) Public bucket for case media (photos + scans)
INSERT INTO storage.buckets (id, name, public)
VALUES ('case-media', 'case-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "case-media public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'case-media');

CREATE POLICY "case-media auth upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'case-media' AND auth.uid() IS NOT NULL);

CREATE POLICY "case-media auth update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'case-media' AND auth.uid() IS NOT NULL);

CREATE POLICY "case-media auth delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'case-media' AND auth.uid() IS NOT NULL);