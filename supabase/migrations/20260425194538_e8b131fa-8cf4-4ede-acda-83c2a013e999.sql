
INSERT INTO storage.buckets (id, name, public) VALUES ('lab-logos', 'lab-logos', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Lab logos public read" ON storage.objects FOR SELECT USING (bucket_id = 'lab-logos');
CREATE POLICY "Lab members upload logo" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'lab-logos');
CREATE POLICY "Lab members update logo" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'lab-logos');
CREATE POLICY "Lab members delete logo" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'lab-logos');
