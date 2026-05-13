import { supabase } from "@/lib/supabase";

interface RegenerateEmbeddingsResult {
  processed: number;
  failed: number;
  total: number;
  errors?: Array<{ expert_id?: string; error: string }>;
}

export async function regenerateExpertEmbedding(expertId: string): Promise<void> {
  const { error, data } = await supabase.functions.invoke("generate_expert_embeddings", {
    body: { expert_id: expertId },
  });

  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
}

export async function regenerateAllExpertEmbeddings(): Promise<RegenerateEmbeddingsResult> {
  const { error, data } = await supabase.functions.invoke("generate_expert_embeddings", {
    body: { regenerate_all: true },
  });

  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);

  return {
    processed: Number((data as any)?.processed || 0),
    failed: Number((data as any)?.failed || 0),
    total: Number((data as any)?.total || 0),
    errors: (data as any)?.errors,
  };
}
