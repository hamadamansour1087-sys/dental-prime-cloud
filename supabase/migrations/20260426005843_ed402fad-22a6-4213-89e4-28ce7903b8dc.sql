ALTER TABLE public.delivery_routes
  ADD COLUMN IF NOT EXISTS governorates text[] NOT NULL DEFAULT '{}'::text[];