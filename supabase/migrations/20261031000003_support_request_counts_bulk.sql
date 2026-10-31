-- =============================================================================
-- Support Requests: tab notification counts + bulk status change (2026-10-31)
--
-- fn_admin_support_request_counts — what the Super Admin tab badge shows:
--   new_count          requests nobody has picked up yet (status 'new')
--   urgent_open_count  urgent requests still open (new or in progress)
-- Counts only; no request content leaves the database.
--
-- fn_admin_set_support_request_status_bulk — the bulk "Mark in progress / done"
-- action. Same rules as the single-row RPC; returns how many rows changed.
-- Both staff-admin only.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_admin_support_request_counts()
RETURNS TABLE (new_count integer, urgent_open_count integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.fn_caller_is_staff_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT count(*) FILTER (WHERE r.status = 'new')::integer,
         count(*) FILTER (WHERE r.is_urgent AND r.status IN ('new', 'in_progress'))::integer
  FROM public.support_requests r;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_support_request_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_support_request_counts() TO authenticated;


CREATE OR REPLACE FUNCTION public.fn_admin_set_support_request_status_bulk(p_ids uuid[], p_status text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.fn_caller_is_staff_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF p_status NOT IN ('new', 'in_progress', 'done') THEN
    RAISE EXCEPTION 'Invalid status %', p_status;
  END IF;
  IF p_ids IS NULL OR cardinality(p_ids) = 0 THEN
    RETURN 0;
  END IF;
  IF cardinality(p_ids) > 200 THEN
    RAISE EXCEPTION 'Too many requests in one bulk action (max 200)';
  END IF;

  UPDATE public.support_requests
     SET status     = p_status,
         handled_by = auth.uid(),
         done_at    = CASE WHEN p_status = 'done' THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = ANY (p_ids) AND status <> p_status;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_set_support_request_status_bulk(uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_set_support_request_status_bulk(uuid[], text) TO authenticated;

-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.fn_admin_set_support_request_status_bulk(uuid[], text);
--   DROP FUNCTION IF EXISTS public.fn_admin_support_request_counts();
