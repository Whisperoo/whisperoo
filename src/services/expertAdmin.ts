import { supabase } from '@/lib/supabase';
import { productService } from '@/services/products';
import { removeStoredFileUrl } from '@/services/storage-cleanup';

/**
 * Permanently removes an expert profile row after deleting all products/resources
 * (including linked storage via productService.deleteProductPermanently) and the
 * expert profile image when it lives in Supabase Storage.
 */
export async function deleteExpertAndResources(expertId: string): Promise<void> {
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('profile_image_url')
    .eq('id', expertId)
    .maybeSingle();
  if (profErr) throw profErr;

  const { data: productRows, error: pErr } = await supabase.from('products').select('id').eq('expert_id', expertId);
  if (pErr) throw pErr;

  for (const row of productRows ?? []) {
    await productService.deleteProductPermanently(row.id);
  }

  await removeStoredFileUrl(profile?.profile_image_url ?? null);

  // Remove phi_access_log rows referencing this profile as patient_user_id.
  // The FK lacks ON DELETE CASCADE, so without this the profile delete fails.
  // A companion migration adds ON DELETE SET NULL for future robustness.
  await supabase.from('phi_access_log').delete().eq('patient_user_id', expertId);

  const { error } = await supabase.from('profiles').delete().eq('id', expertId);
  if (error) throw error;
}
