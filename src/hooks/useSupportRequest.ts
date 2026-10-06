import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  createSupportRequest,
  getMySupportStatus,
  saveSupportAnswers,
  type SupportAnswers,
} from '@/services/support';

const statusKey = (userId: string | undefined) => ['support-status', userId] as const;

/** Latest open Get Support request (or null) plus what to show on the status card. */
export function useMySupportStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: statusKey(user?.id),
    queryFn: getMySupportStatus,
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function useSupportMutations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: statusKey(user?.id) });

  const create = useMutation({
    mutationFn: (text: string) => createSupportRequest(text),
    onSuccess: refresh,
  });
  const answers = useMutation({
    mutationFn: ({ id, answers }: { id: string; answers: SupportAnswers }) => saveSupportAnswers(id, answers),
    onSuccess: refresh,
  });
  return { create, answers };
}
