-- ============================================================================
-- Migration: Backfill tenant_id and is_hospital_resource for products created
--            by hospital-affiliated experts.
--
-- Problem: Products uploaded via the expert dashboard before 2026-05-16 did not
--          inherit the expert's tenant_id or set is_hospital_resource = true,
--          so they appeared as Whisperoo resources instead of hospital resources.
--
-- Rule (per product policy): Any product whose expert is affiliated with a
--          tenant is a hospital resource for that tenant, regardless of whether
--          it was created by the expert or by a super admin.
-- ============================================================================

UPDATE public.products p
SET
  tenant_id          = pr.tenant_id,
  is_hospital_resource = true
FROM public.profiles pr
WHERE p.expert_id = pr.id
  AND pr.tenant_id IS NOT NULL          -- expert is hospital-affiliated
  AND (
    p.tenant_id IS NULL                 -- not yet tagged
    OR p.is_hospital_resource IS NOT TRUE  -- tagged as Whisperoo incorrectly
  );
