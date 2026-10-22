CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id text NOT NULL DEFAULT 'demo',
  service_id text,
  service_name text NOT NULL,
  category text NOT NULL,
  plan_name text NOT NULL,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  billing_interval text NOT NULL,
  interval_months integer NOT NULL DEFAULT 1 CHECK (interval_months > 0),
  start_date date NOT NULL,
  next_renewal date NOT NULL,
  autopay boolean NOT NULL DEFAULT false,
  notes text,
  is_custom boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  cancelled_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_profile_status_idx ON public.subscriptions(profile_id, status);
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.reminder_settings (
  profile_id text PRIMARY KEY,
  intervals integer[] NOT NULL DEFAULT '{7,3,1,0}',
  browser_notifications boolean NOT NULL DEFAULT false,
  display_name text NOT NULL DEFAULT 'Demo User',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.reminder_settings TO service_role;
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.reminder_settings(profile_id) VALUES ('demo');

CREATE TABLE public.reminder_reads (
  profile_id text NOT NULL,
  reminder_key text NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, reminder_key)
);
GRANT ALL ON public.reminder_reads TO service_role;
ALTER TABLE public.reminder_reads ENABLE ROW LEVEL SECURITY;