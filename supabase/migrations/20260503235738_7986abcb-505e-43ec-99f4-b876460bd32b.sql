
-- Table to track delivery agent daily routes with GPS coordinates
CREATE TABLE public.agent_tracking_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  event_type text NOT NULL DEFAULT 'checkpoint', -- 'delivery', 'pickup', 'checkpoint'
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  location_accuracy double precision,
  case_id uuid,
  doctor_id uuid,
  notes text,
  tracked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_tracking_agent_date ON public.agent_tracking_points (agent_id, tracked_at);
CREATE INDEX idx_agent_tracking_lab_date ON public.agent_tracking_points (lab_id, tracked_at);

ALTER TABLE public.agent_tracking_points ENABLE ROW LEVEL SECURITY;

-- Agent can insert own tracking points
CREATE POLICY "agent inserts own tracking"
ON public.agent_tracking_points FOR INSERT
WITH CHECK (agent_id = current_agent_id() AND lab_id = current_agent_lab_id());

-- Agent reads own tracking points
CREATE POLICY "agent reads own tracking"
ON public.agent_tracking_points FOR SELECT
USING (agent_id = current_agent_id());

-- Lab members read all tracking points
CREATE POLICY "lab members read tracking"
ON public.agent_tracking_points FOR SELECT
USING (is_lab_member(lab_id));

-- Managers delete tracking points
CREATE POLICY "managers delete tracking"
ON public.agent_tracking_points FOR DELETE
USING (is_lab_manager_or_admin(lab_id));
