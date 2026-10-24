-- Cover every booking foreign key used by deletes and audit lookups.
CREATE INDEX booking_offerings_created_by_idx
  ON public.booking_offerings (created_by);

CREATE INDEX booking_reservations_booked_by_idx
  ON public.booking_reservations (booked_by);

CREATE INDEX booking_reservations_cancelled_by_idx
  ON public.booking_reservations (cancelled_by)
  WHERE cancelled_by IS NOT NULL;
