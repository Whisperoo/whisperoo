/**
 * Get Support intake — parent side.
 *
 * Creating a request and saving answers go through the `support-intake` edge
 * function, which runs the safety checks before anything is stored. Reading the
 * status card is a single RPC that returns the latest open request together with
 * topic-ranked experts/resources. The team sources help off-platform, so there is no
 * in-app match; a request leaves the card when the team marks it done.
 */
import { supabase } from '@/lib/supabase';

export type SupportStatus = 'new' | 'in_progress' | 'done';

/** Canonical (English) answer values are stored; the UI translates them for display. */
export interface SupportAnswers {
  support_type?: string;
  insurance?: string;
  provider?: string;
  notes?: string;
}

export interface SupportExpert {
  id: string;
  name: string;
  role: string | null;
  image: string | null;
}

export interface SupportProduct {
  id: string;
  title: string;
  product_type: string | null;
  content_type: string | null;
  thumbnail: string | null;
  expert_name: string | null;
}

export interface MySupportStatus {
  id: string;
  status: SupportStatus;
  topic: string | null;
  request_text: string;
  answers: SupportAnswers;
  empathy_reply: string | null;
  is_urgent: boolean;
  created_at: string;
  experts: SupportExpert[];
  products: SupportProduct[];
}

export interface CreateResult {
  id: string;
  topic: string;
  reply: string;
  urgent: boolean;
}

export interface AnswersResult {
  ok: boolean;
  urgent: boolean;
  crisis: string | null;
}

/** Pulls the `{ error }` message out of a non-2xx edge function response. */
async function invokeIntake<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('support-intake', { body });
  if (error) {
    let detail: string | undefined;
    try {
      detail = (await (error as { context?: Response }).context?.json?.())?.error;
    } catch {
      // body was not JSON; fall back to the generic message
    }
    throw new Error(detail || error.message);
  }
  if (!data) throw new Error('Empty response from support-intake');
  return data;
}

export const createSupportRequest = (text: string) =>
  invokeIntake<CreateResult>({ action: 'create', text });

export const saveSupportAnswers = (id: string, answers: SupportAnswers) =>
  invokeIntake<AnswersResult>({ action: 'answers', id, answers });

export async function getMySupportStatus(): Promise<MySupportStatus | null> {
  const { data, error } = await supabase.rpc('fn_my_support_status');
  if (error) throw error;
  return (data as MySupportStatus | null) ?? null;
}
