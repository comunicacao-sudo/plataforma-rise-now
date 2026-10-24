-- RISE NOW calendar and 1:1 booking. Privileged writes stay behind rise-backend.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

CREATE TABLE public.booking_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 120),
  description text,
  duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 15 AND 240),
  buffer_minutes integer NOT NULL DEFAULT 15 CHECK (buffer_minutes BETWEEN 0 AND 120),
  booking_notice_hours integer NOT NULL DEFAULT 24 CHECK (booking_notice_hours BETWEEN 0 AND 720),
  cancellation_notice_hours integer NOT NULL DEFAULT 24 CHECK (cancellation_notice_hours BETWEEN 0 AND 720),
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo' CHECK (timezone = 'America/Sao_Paulo'),
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'cohorts')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.booking_offering_cohorts (
  offering_id uuid NOT NULL REFERENCES public.booking_offerings(id) ON DELETE CASCADE,
  cohort_id uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  PRIMARY KEY (offering_id, cohort_id)
);

CREATE TABLE public.booking_availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL REFERENCES public.booking_offerings(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  valid_from date NOT NULL DEFAULT current_date,
  valid_until date,
  slot_interval_minutes integer NOT NULL DEFAULT 30 CHECK (slot_interval_minutes BETWEEN 15 AND 240),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

CREATE TABLE public.booking_availability_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL REFERENCES public.booking_offerings(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  is_available boolean NOT NULL DEFAULT false,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE public.booking_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL REFERENCES public.booking_offerings(id) ON DELETE RESTRICT,
  mentor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE RESTRICT,
  meeting_id uuid UNIQUE REFERENCES public.meetings(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  booked_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  cancelled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  slot tstzrange GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)')) STORED,
  CHECK (ends_at > starts_at)
);

ALTER TABLE public.booking_reservations
  ADD CONSTRAINT booking_reservations_mentor_no_overlap
  EXCLUDE USING gist (mentor_id WITH =, slot WITH &&)
  WHERE (status IN ('pending', 'confirmed'));

ALTER TABLE public.booking_reservations
  ADD CONSTRAINT booking_reservations_mentee_no_overlap
  EXCLUDE USING gist (enrollment_id WITH =, slot WITH &&)
  WHERE (status IN ('pending', 'confirmed'));

CREATE INDEX booking_offerings_mentor_status_idx
  ON public.booking_offerings (mentor_id, status);
CREATE INDEX booking_offering_cohorts_cohort_idx
  ON public.booking_offering_cohorts (cohort_id, offering_id);
CREATE INDEX booking_rules_offering_weekday_idx
  ON public.booking_availability_rules (offering_id, weekday)
  WHERE active;
CREATE INDEX booking_exceptions_offering_time_idx
  ON public.booking_availability_exceptions (offering_id, starts_at, ends_at);
CREATE INDEX booking_reservations_offering_time_idx
  ON public.booking_reservations (offering_id, starts_at)
  WHERE status IN ('pending', 'confirmed');
CREATE INDEX booking_reservations_enrollment_time_idx
  ON public.booking_reservations (enrollment_id, starts_at)
  WHERE status IN ('pending', 'confirmed');

ALTER TABLE public.booking_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_offering_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_availability_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_reservations ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.booking_offerings TO service_role;
GRANT ALL ON public.booking_offering_cohorts TO service_role;
GRANT ALL ON public.booking_availability_rules TO service_role;
GRANT ALL ON public.booking_availability_exceptions TO service_role;
GRANT ALL ON public.booking_reservations TO service_role;

CREATE POLICY "backend only: booking offerings" ON public.booking_offerings
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "backend only: booking offering cohorts" ON public.booking_offering_cohorts
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "backend only: booking availability rules" ON public.booking_availability_rules
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "backend only: booking availability exceptions" ON public.booking_availability_exceptions
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "backend only: booking reservations" ON public.booking_reservations
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.touch_booking_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  new.updated_at := now();
  RETURN new;
END;
$$;
REVOKE ALL ON FUNCTION public.touch_booking_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_booking_updated_at() TO service_role;

CREATE TRIGGER booking_offerings_touch_updated_at
BEFORE UPDATE ON public.booking_offerings
FOR EACH ROW EXECUTE FUNCTION public.touch_booking_updated_at();

CREATE TRIGGER booking_reservations_touch_updated_at
BEFORE UPDATE ON public.booking_reservations
FOR EACH ROW EXECUTE FUNCTION public.touch_booking_updated_at();
