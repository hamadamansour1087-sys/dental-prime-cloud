
-- Allow doctors to update their own cases (for editing from portal)
CREATE POLICY "doctor updates own cases"
ON public.cases
FOR UPDATE
TO authenticated
USING (doctor_id = current_doctor_id())
WITH CHECK (doctor_id = current_doctor_id());

-- Allow doctors to delete their own case items (needed when editing replaces items)
CREATE POLICY "doctor deletes own case items"
ON public.case_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM cases c
    WHERE c.id = case_items.case_id
      AND c.doctor_id = current_doctor_id()
  )
);

-- Allow doctors to update their own case items
CREATE POLICY "doctor updates own case items"
ON public.case_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM cases c
    WHERE c.id = case_items.case_id
      AND c.doctor_id = current_doctor_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM cases c
    WHERE c.id = case_items.case_id
      AND c.doctor_id = current_doctor_id()
  )
);
