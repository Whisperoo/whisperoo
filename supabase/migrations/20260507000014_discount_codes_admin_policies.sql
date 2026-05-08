-- Enable admin CRUD for discount codes used in Stripe checkout.

ALTER TABLE IF EXISTS public.discount_codes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.discount_codes TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_discount_usage(uuid) TO authenticated;

DROP POLICY IF EXISTS "Admins can manage discount codes" ON public.discount_codes;
CREATE POLICY "Admins can manage discount codes"
ON public.discount_codes
FOR ALL
TO authenticated
USING (
  (auth.jwt() ->> 'email') IN ('engineering@whisperoo.app', 'sharab.khan101010@gmail.com')
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.account_type IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  (auth.jwt() ->> 'email') IN ('engineering@whisperoo.app', 'sharab.khan101010@gmail.com')
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.account_type IN ('admin', 'super_admin')
  )
);
