
CREATE TABLE IF NOT EXISTS public.nether_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  redeemed_by uuid,
  redeemed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
ALTER TABLE public.nether_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read codes" ON public.nether_codes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "owners insert codes" ON public.nether_codes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Seed a handful of codes
INSERT INTO public.nether_codes (code) VALUES
  ('NETHER-WELCOME'),
  ('NETHER-FOUNDER'),
  ('NETHER-AETHER01'),
  ('NETHER-AETHER02'),
  ('NETHER-AETHER03')
ON CONFLICT DO NOTHING;
