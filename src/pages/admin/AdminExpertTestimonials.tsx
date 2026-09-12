import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, Pencil, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Check, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

/**
 * Admin-curated testimonials for one expert.
 *
 * Sprint 2 (QUO-2026-004) workstream 2: "Dashboard support for admin-entered
 * testimonials (create, edit, order, publish/unpublish)". The public expert
 * screen that displays these waits on the Figma file; this editor does not.
 *
 * Admin-only by construction: the RLS policy on expert_testimonials permits
 * writes solely via fn_caller_is_staff_admin(). Experts have no write path —
 * an expert must not be able to author praise attributed to a patient.
 *
 * Rendered inside AdminExpertForm for an existing expert only. A brand-new
 * expert has no id yet to attach testimonials to.
 */

interface Testimonial {
  id: string;
  expert_id: string;
  author_name: string;
  author_context: string | null;
  quote: string;
  quote_es: string | null;
  quote_vi: string | null;
  testimonial_date: string | null;
  display_order: number;
  published: boolean;
}

type Draft = Omit<Testimonial, 'id' | 'expert_id' | 'display_order' | 'published'>;

const EMPTY_DRAFT: Draft = {
  author_name: '',
  author_context: '',
  quote: '',
  quote_es: '',
  quote_vi: '',
  testimonial_date: '',
};

interface Props {
  expertId: string;
}

const AdminExpertTestimonials: React.FC<Props> = ({ expertId }) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  // null = not editing; 'new' = creating; otherwise the id being edited
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('expert_testimonials')
        .select('*')
        .eq('expert_id', expertId)
        .order('display_order', { ascending: true });
      if (error) throw error;
      setItems((data as Testimonial[]) ?? []);
    } catch (err) {
      console.error('Error loading testimonials:', err);
      toast({ title: t('admin.testimonials.loadError', 'Could not load testimonials'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [expertId, t]);

  useEffect(() => { load(); }, [load]);

  const startNew = () => { setDraft(EMPTY_DRAFT); setEditing('new'); };
  const startEdit = (row: Testimonial) => {
    setDraft({
      author_name: row.author_name,
      author_context: row.author_context ?? '',
      quote: row.quote,
      quote_es: row.quote_es ?? '',
      quote_vi: row.quote_vi ?? '',
      testimonial_date: row.testimonial_date ?? '',
    });
    setEditing(row.id);
  };
  const cancelEdit = () => { setEditing(null); setDraft(EMPTY_DRAFT); };

  // Empty optional strings are stored as NULL, not '', so the public page can
  // fall back to English cleanly with a plain `?? quote` instead of testing ''.
  const nullIfBlank = (v: string) => (v.trim() === '' ? null : v.trim());

  const save = async () => {
    if (!draft.author_name.trim() || !draft.quote.trim()) {
      toast({ title: t('admin.testimonials.required', 'Author name and quote are required'), variant: 'destructive' });
      return;
    }
    setBusyId(editing);
    try {
      const payload = {
        author_name: draft.author_name.trim(),
        author_context: nullIfBlank(draft.author_context ?? ''),
        quote: draft.quote.trim(),
        quote_es: nullIfBlank(draft.quote_es ?? ''),
        quote_vi: nullIfBlank(draft.quote_vi ?? ''),
        testimonial_date: nullIfBlank(draft.testimonial_date ?? ''),
      };
      if (editing === 'new') {
        // Append at the end. published stays false (the column default) — going
        // live is a separate, explicit click, never a side-effect of saving.
        const nextOrder = items.length ? Math.max(...items.map((i) => i.display_order)) + 1 : 0;
        const { error } = await supabase
          .from('expert_testimonials')
          .insert({ ...payload, expert_id: expertId, display_order: nextOrder });
        if (error) throw error;
        toast({ title: t('admin.testimonials.created', 'Testimonial added (unpublished)') });
      } else {
        const { error } = await supabase.from('expert_testimonials').update(payload).eq('id', editing);
        if (error) throw error;
        toast({ title: t('admin.testimonials.saved', 'Testimonial saved') });
      }
      cancelEdit();
      await load();
    } catch (err) {
      console.error('Error saving testimonial:', err);
      toast({ title: t('admin.testimonials.saveError', 'Could not save testimonial'), variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const togglePublished = async (row: Testimonial) => {
    setBusyId(row.id);
    try {
      const { error } = await supabase
        .from('expert_testimonials')
        .update({ published: !row.published })
        .eq('id', row.id);
      if (error) throw error;
      await load();
    } catch (err) {
      console.error('Error toggling testimonial:', err);
      toast({ title: t('admin.testimonials.toggleError', 'Could not update publish state'), variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  // Reorder by swapping display_order with the neighbour. Two updates rather than
  // renumbering the whole list: it touches only the rows that actually moved.
  const move = async (index: number, direction: -1 | 1) => {
    const a = items[index];
    const b = items[index + direction];
    if (!a || !b) return;
    setBusyId(a.id);
    try {
      const [r1, r2] = await Promise.all([
        supabase.from('expert_testimonials').update({ display_order: b.display_order }).eq('id', a.id),
        supabase.from('expert_testimonials').update({ display_order: a.display_order }).eq('id', b.id),
      ]);
      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;
      await load();
    } catch (err) {
      console.error('Error reordering testimonials:', err);
      toast({ title: t('admin.testimonials.reorderError', 'Could not reorder'), variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (row: Testimonial) => {
    if (!window.confirm(t('admin.testimonials.confirmDelete', 'Delete this testimonial? This cannot be undone.'))) return;
    setBusyId(row.id);
    try {
      const { error } = await supabase.from('expert_testimonials').delete().eq('id', row.id);
      if (error) throw error;
      toast({ title: t('admin.testimonials.deleted', 'Testimonial deleted') });
      await load();
    } catch (err) {
      console.error('Error deleting testimonial:', err);
      toast({ title: t('admin.testimonials.deleteError', 'Could not delete testimonial'), variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const inputCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'text-xs font-medium text-gray-600 mb-1 block';

  const editor = (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{t('admin.testimonials.authorName', 'Author name')} *</label>
          <input className={inputCls} value={draft.author_name}
            onChange={(e) => setDraft({ ...draft, author_name: e.target.value })} placeholder="Sarah M." />
        </div>
        <div>
          <label className={labelCls}>{t('admin.testimonials.authorContext', 'Context')}</label>
          <input className={inputCls} value={draft.author_context ?? ''}
            onChange={(e) => setDraft({ ...draft, author_context: e.target.value })}
            placeholder={t('admin.testimonials.contextHint', 'Mother of two, OB patient — keep non-identifying')} />
        </div>
      </div>
      <div>
        <label className={labelCls}>{t('admin.testimonials.quote', 'Quote')} *</label>
        <textarea className={inputCls} rows={3} value={draft.quote}
          onChange={(e) => setDraft({ ...draft, quote: e.target.value })} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{t('admin.testimonials.quoteEs', 'Quote (Spanish)')}</label>
          <textarea className={inputCls} rows={2} value={draft.quote_es ?? ''}
            onChange={(e) => setDraft({ ...draft, quote_es: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>{t('admin.testimonials.quoteVi', 'Quote (Vietnamese)')}</label>
          <textarea className={inputCls} rows={2} value={draft.quote_vi ?? ''}
            onChange={(e) => setDraft({ ...draft, quote_vi: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
        <div>
          <label className={labelCls}>{t('admin.testimonials.date', 'Date')}</label>
          <input type="date" className={inputCls} value={draft.testimonial_date ?? ''}
            onChange={(e) => setDraft({ ...draft, testimonial_date: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={cancelEdit}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
            {t('admin.testimonials.cancel', 'Cancel')}
          </button>
          <button type="button" onClick={save} disabled={busyId !== null}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {busyId === editing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {editing === 'new' ? t('admin.testimonials.add', 'Add testimonial') : t('admin.testimonials.save', 'Save')}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-medium text-gray-600 block">
            {t('admin.testimonials.title', 'Testimonials')}
          </label>
          <p className="text-[11px] text-gray-400">
            {t('admin.testimonials.subtitle', 'Admin-entered. New ones start unpublished; publishing is a deliberate step.')}
          </p>
        </div>
        {editing === null && (
          <button type="button" onClick={startNew}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors">
            <Plus className="w-4 h-4" /> {t('admin.testimonials.new', 'New')}
          </button>
        )}
      </div>

      {editing === 'new' && editor}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
          <Loader2 className="w-4 h-4 animate-spin" /> {t('admin.testimonials.loading', 'Loading…')}
        </div>
      ) : items.length === 0 && editing !== 'new' ? (
        <p className="text-sm text-gray-400 py-3">
          {t('admin.testimonials.empty', 'No testimonials yet.')}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((row, index) => (
            <li key={row.id}>
              {editing === row.id ? editor : (
                <div className={`flex items-start gap-3 rounded-xl border p-3 ${row.published ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white'}`}>
                  <div className="flex flex-col gap-0.5 pt-0.5">
                    <button type="button" onClick={() => move(index, -1)} disabled={index === 0 || busyId !== null}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label="Move up">
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => move(index, 1)} disabled={index === items.length - 1 || busyId !== null}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label="Move down">
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{row.author_name}</span>
                      {row.author_context && <span className="text-xs text-gray-500">· {row.author_context}</span>}
                      {row.testimonial_date && <span className="text-xs text-gray-400">· {row.testimonial_date}</span>}
                      <span className={`ml-auto text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded ${row.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {row.published ? t('admin.testimonials.published', 'Published') : t('admin.testimonials.draft', 'Draft')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1 line-clamp-2">“{row.quote}”</p>
                    {(row.quote_es || row.quote_vi) && (
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {row.quote_es ? 'ES ' : ''}{row.quote_vi ? 'VI' : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => togglePublished(row)} disabled={busyId !== null}
                      title={row.published ? t('admin.testimonials.unpublish', 'Unpublish') : t('admin.testimonials.publish', 'Publish')}
                      className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${row.published ? 'text-green-600 hover:bg-green-100' : 'text-gray-400 hover:bg-gray-100'}`}>
                      {busyId === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : row.published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button type="button" onClick={() => startEdit(row)} disabled={busyId !== null}
                      title={t('admin.testimonials.edit', 'Edit')}
                      className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-40">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => remove(row)} disabled={busyId !== null}
                      title={t('admin.testimonials.delete', 'Delete')}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminExpertTestimonials;
