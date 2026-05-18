-- Allow experts to SELECT and UPDATE their own consultation bookings.
--
-- The existing "Users can view own bookings" policy only covers user_id.
-- Experts need to see bookings where expert_id = auth.uid() so the
-- Expert Dashboard Consultations tab can load their incoming appointments.
-- The UPDATE policy lets them confirm/complete bookings from that dashboard.

CREATE POLICY "Experts can view own consultation bookings"
ON public.consultation_bookings
FOR SELECT
USING (auth.uid() = expert_id);

CREATE POLICY "Experts can update own consultation bookings"
ON public.consultation_bookings
FOR UPDATE
USING (auth.uid() = expert_id)
WITH CHECK (auth.uid() = expert_id);
