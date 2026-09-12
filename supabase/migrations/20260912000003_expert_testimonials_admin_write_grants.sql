-- Let staff admins actually write to expert_testimonials.
--
-- 20260909000001 granted `authenticated` SELECT only. That was too tight: admins
-- are `authenticated` too, so their INSERT/UPDATE/DELETE was refused at the table
-- grant before the "Admins manage expert testimonials" RLS policy was consulted.
-- The policy was correct; the grant beneath it was not.
--
-- This is the standard layering: table grants to `authenticated`, and RLS decides
-- who may exercise them. Non-admins still cannot write -- the only policy that
-- permits INSERT/UPDATE/DELETE checks fn_caller_is_staff_admin(), so they are
-- refused by RLS instead of by the grant. Same outcome for them, correct outcome
-- for admins.

GRANT INSERT, UPDATE, DELETE ON public.expert_testimonials TO authenticated;

-- ROLLBACK: REVOKE INSERT, UPDATE, DELETE ON public.expert_testimonials FROM authenticated;
