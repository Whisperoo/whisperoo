import React, { useEffect, useState } from 'react';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { uploadFile, deleteFile } from '@/services/cloudflare-storage';
import { extractRelativePath } from '@/config/cloudflare';

/**
 * Expert intro video ("Meet {name}") — client request 2026-10-03.
 *
 * Upload to R2 + an on/off switch, so an expert without a video (or one being
 * re-recorded) simply doesn't show the section. Like testimonials, every action here
 * saves immediately and independently of the main form's Save button.
 *
 * The page shows the video only when expert_video_enabled AND expert_video_url are set.
 */

const MAX_MB = 500;
const ACCEPT = 'video/mp4,video/webm,video/quicktime';

const AdminExpertIntroVideo: React.FC<{ expertId: string }> = ({ expertId }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'upload' | 'toggle' | 'remove' | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('expert_video_url, expert_video_enabled')
        .eq('id', expertId)
        .single();
      if (error) console.error('Intro video: load failed', error);
      setUrl(data?.expert_video_url ?? null);
      setEnabled(data?.expert_video_enabled ?? true);
      setLoading(false);
    })();
  }, [expertId]);

  const save = async (patch: Record<string, unknown>) => {
    const { error } = await supabase.from('profiles').update(patch).eq('id', expertId);
    if (error) throw error;
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast({ title: `Video is larger than ${MAX_MB} MB`, variant: 'destructive' });
      return;
    }
    setBusy('upload');
    const previous = url;
    try {
      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
      const { publicUrl } = await uploadFile({
        filePath: `expert-videos/${expertId}/intro-${Date.now()}.${ext}`,
        file,
        contentType: file.type || 'video/mp4',
      });
      await save({ expert_video_url: publicUrl });
      setUrl(publicUrl);
      toast({ title: 'Intro video uploaded' });
      // Old file is unreferenced now; failing to delete it only leaves an orphan.
      if (previous) deleteFile(extractRelativePath(previous)).catch((e) => console.error('Intro video: old file cleanup failed', e));
    } catch (err) {
      console.error('Intro video: upload failed', err);
      toast({ title: 'Upload failed', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const toggle = async () => {
    setBusy('toggle');
    try {
      await save({ expert_video_enabled: !enabled });
      setEnabled(!enabled);
    } catch (err) {
      console.error('Intro video: toggle failed', err);
      toast({ title: 'Could not change visibility', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!url || !window.confirm('Remove this intro video?')) return;
    setBusy('remove');
    try {
      await save({ expert_video_url: null });
      deleteFile(extractRelativePath(url)).catch((e) => console.error('Intro video: file delete failed', e));
      setUrl(null);
    } catch (err) {
      console.error('Intro video: remove failed', err);
      toast({ title: 'Could not remove video', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading video…</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Intro video</h4>
          <p className="text-xs text-gray-500">Shown as “Meet {'{name}'}” on the expert's profile.</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
          <span>{enabled ? 'Shown' : 'Hidden'}</span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Show intro video on profile"
            onClick={toggle}
            disabled={busy !== null}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-60 ${enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
        </label>
      </div>

      {url ? (
        <video src={url} controls preload="metadata" className="w-full max-h-56 rounded-lg bg-black" />
      ) : (
        <p className="text-xs text-gray-400">No video uploaded. The section stays hidden until one is added.</p>
      )}
      {url && !enabled && (
        <p className="text-xs text-amber-700">Uploaded but hidden. Parents won't see it until you switch it on.</p>
      )}

      <div className="flex items-center gap-2">
        <label className={`inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${busy ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}>
          {busy === 'upload' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {url ? 'Replace video' : 'Upload video'}
          <input type="file" accept={ACCEPT} className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {url && (
          <button type="button" onClick={remove} disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60">
            {busy === 'remove' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Remove
          </button>
        )}
      </div>
      <p className="text-[11px] text-gray-400">MP4, WebM or MOV, up to {MAX_MB} MB.</p>
    </div>
  );
};

export default AdminExpertIntroVideo;
