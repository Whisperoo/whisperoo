-- Allow super admins to create and manage QR codes.
-- Previously only SELECT was granted; admins had no way to INSERT
-- tracked QR tokens, so the config panel was generating plain tenant
-- URLs that bypass the entire tracking system.

DROP POLICY IF EXISTS "Admins can manage qr codes" ON public.qr_codes;
CREATE POLICY "Admins can manage qr codes"
  ON public.qr_codes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'super_admin')
    )
  );
