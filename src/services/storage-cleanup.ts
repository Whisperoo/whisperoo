import { supabase } from '@/lib/supabase';
import { CLOUDFLARE_R2_CONFIG, isCloudflareConfigured } from '@/config/cloudflare';
import { deleteFile } from '@/services/cloudflare-storage';

const PUBLIC_MARKER = '/storage/v1/object/public/';

/** Parse Supabase Storage public URL into bucket + object path (for `.remove()`). */
export function parseSupabaseStoragePublicUrl(
  url: string | null | undefined,
): { bucket: string; path: string } | null {
  if (!url?.trim()) return null;
  const u = url.trim();
  const idx = u.indexOf(PUBLIC_MARKER);
  if (idx === -1) return null;
  const rest = u.slice(idx + PUBLIC_MARKER.length);
  const slash = rest.indexOf('/');
  if (slash === -1) return null;
  const bucket = rest.slice(0, slash);
  const path = rest.slice(slash + 1).split('?')[0];
  if (!bucket || !path) return null;
  return { bucket, path: decodeURIComponent(path) };
}

export function isSupabaseStoragePublicUrl(url: string | null | undefined): boolean {
  return parseSupabaseStoragePublicUrl(url) != null;
}

function isLikelyR2PublicUrl(url: string): boolean {
  if (!isCloudflareConfigured()) return false;
  const base = (CLOUDFLARE_R2_CONFIG.publicUrl || '').replace(/\/$/, '');
  return Boolean(base && url.startsWith(base));
}

/** Best-effort: Supabase public object first, else Cloudflare R2 if configured. */
export async function removeStoredFileUrl(url: string | null | undefined): Promise<void> {
  if (!url?.trim()) return;
  const u = url.trim();

  const parsed = parseSupabaseStoragePublicUrl(u);
  if (parsed) {
    const { error } = await supabase.storage.from(parsed.bucket).remove([parsed.path]);
    if (error) console.error('storage-cleanup: Supabase remove failed', parsed, error);
    return;
  }

  if (isLikelyR2PublicUrl(u)) {
    try {
      await deleteFile(u);
    } catch (e) {
      console.warn('storage-cleanup: R2 remove failed (ignored)', e);
    }
  }
}

export async function removeStoredFileUrls(urls: (string | null | undefined)[]): Promise<void> {
  const unique = [...new Set(urls.filter(Boolean) as string[])];
  for (const u of unique) {
    await removeStoredFileUrl(u);
  }
}
