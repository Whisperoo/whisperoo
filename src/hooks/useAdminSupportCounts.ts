import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Counts behind the Support Requests tab badge: new (not picked up yet) and urgent
 * requests still open. Counts only — no request content. Refreshes every minute
 * while the portal is open, and immediately when a request's status changes
 * (call invalidate()).
 */
export const SUPPORT_COUNTS_KEY = ['admin-support-counts'] as const;

export interface SupportCounts {
  newCount: number;
  urgentOpenCount: number;
}

export function useAdminSupportCounts(enabled = true) {
  return useQuery({
    queryKey: SUPPORT_COUNTS_KEY,
    enabled,
    refetchInterval: 60_000,
    queryFn: async (): Promise<SupportCounts> => {
      const { data, error } = await supabase.rpc('fn_admin_support_request_counts');
      if (error) throw error;
      const row = (data as Array<{ new_count: number; urgent_open_count: number }> | null)?.[0];
      return { newCount: row?.new_count ?? 0, urgentOpenCount: row?.urgent_open_count ?? 0 };
    },
  });
}

export function useInvalidateSupportCounts() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: SUPPORT_COUNTS_KEY });
}
