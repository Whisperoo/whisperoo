import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Loader2, Pencil, Eye, EyeOff, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

interface CategoryRow {
  id: string;
  name: string;
  keywords: string[];
  mapped_specialties: string[];
  seed_phrase: string | null;
  prompt_notes: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string | null;
}

interface CategoryFormState {
  name: string;
  keywords: string;            // comma-separated in the UI
  mapped_specialties: string;  // comma-separated in the UI, empty = "no specialist"
  seed_phrase: string;
  prompt_notes: string;
  sort_order: string;
  is_active: boolean;
}

const EMPTY_FORM: CategoryFormState = {
  name: '',
  keywords: '',
  mapped_specialties: '',
  seed_phrase: '',
  prompt_notes: '',
  sort_order: '0',
  is_active: true,
};

const toCsv = (arr: string[]) => arr.join(', ');
const fromCsv = (s: string) => s.split(',').map((v) => v.trim()).filter(Boolean);

const ChatTopicCategoriesPanel: React.FC = () => {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('specialty_categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setRows((data ?? []) as CategoryRow[]);
    } catch (err) {
      console.error('ChatTopicCategoriesPanel: fetch error', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to load chat topic categories',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const beginEdit = (row: CategoryRow) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      keywords: toCsv(row.keywords),
      mapped_specialties: toCsv(row.mapped_specialties),
      seed_phrase: row.seed_phrase || '',
      prompt_notes: row.prompt_notes || '',
      sort_order: String(row.sort_order),
      is_active: row.is_active,
    });
  };

  const summary = useMemo(() => {
    const active = rows.filter((r) => r.is_active).length;
    const noSpecialist = rows.filter((r) => r.mapped_specialties.length === 0).length;
    return { total: rows.length, active, noSpecialist };
  }, [rows]);

  const handleSave = async () => {
    const name = form.name.trim();
    const keywords = fromCsv(form.keywords);
    const sortOrder = Number(form.sort_order);

    if (!name) {
      toast({ title: 'Missing name', description: 'Please enter a category name.', variant: 'destructive' });
      return;
    }
    if (keywords.length === 0) {
      toast({ title: 'Missing keywords', description: 'Enter at least one comma-separated keyword.', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(sortOrder)) {
      toast({ title: 'Invalid sort order', description: 'Sort order must be a number.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        keywords,
        mapped_specialties: fromCsv(form.mapped_specialties),
        seed_phrase: form.seed_phrase.trim() || null,
        prompt_notes: form.prompt_notes.trim() || null,
        sort_order: sortOrder,
        is_active: form.is_active,
      };

      if (editingId) {
        const { error } = await supabase.from('specialty_categories').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('specialty_categories').insert(payload);
        if (error) throw error;
      }

      resetForm();
      fetchCategories();
      toast({ title: 'Saved', description: 'Chat topic category saved successfully.' });
    } catch (err) {
      console.error('ChatTopicCategoriesPanel: save error', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save category',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: CategoryRow) => {
    try {
      const { error } = await supabase
        .from('specialty_categories')
        .update({ is_active: !row.is_active })
        .eq('id', row.id);
      if (error) throw error;
      fetchCategories();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update category status',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this chat topic category? This cannot be undone.')) return;
    try {
      const { error } = await supabase.from('specialty_categories').delete().eq('id', id);
      if (error) throw error;
      fetchCategories();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete category',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Chat Topic Categories</h2>
        <p className="text-sm text-gray-500 mt-1">
          {summary.total} total · {summary.active} active · {summary.noSpecialist} with no mapped specialist
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Controls how Chat Genie categorizes messages and matches experts. Changes take effect on the
          next chat message — no code deploy required. Sort order controls detection priority (lower
          numbers checked first); leave "Mapped Specialties" empty for topics with no specialist on the
          platform (the AI will be told not to recommend anyone for that topic).
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Category name (e.g. Sleep Coaching)"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
            placeholder="Sort order (e.g. 50)"
            className="border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <textarea
          value={form.keywords}
          onChange={(e) => setForm({ ...form, keywords: e.target.value })}
          placeholder="Keywords, comma-separated (e.g. sleep, bedtime, nap, night waking)"
          rows={2}
          className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
        />
        <textarea
          value={form.mapped_specialties}
          onChange={(e) => setForm({ ...form, mapped_specialties: e.target.value })}
          placeholder="Mapped specialties, comma-separated (e.g. Sleep Training, Infant Sleep) — leave blank if no specialist covers this topic"
          rows={2}
          className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
        />
        <input
          value={form.seed_phrase}
          onChange={(e) => setForm({ ...form, seed_phrase: e.target.value })}
          placeholder="Seed phrase (optional — used to broaden search on a recurring topic)"
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <textarea
          value={form.prompt_notes}
          onChange={(e) => setForm({ ...form, prompt_notes: e.target.value })}
          placeholder="Prompt notes (optional — disqualifier/guidance shown to the AI; separate multiple lines with ' || ')"
          rows={2}
          className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
        />

        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />
          Active category
        </label>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {editingId ? 'Update Category' : 'Create Category'}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-14 text-center text-sm text-gray-500">No chat topic categories created yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((row) => (
              <div key={row.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">
                    {row.name} <span className="text-gray-400 font-normal">· sort {row.sort_order}</span>
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {row.mapped_specialties.length > 0
                      ? `→ ${row.mapped_specialties.join(', ')}`
                      : '→ No specialist mapped'}
                    {' · '}
                    {row.keywords.length} keyword{row.keywords.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${row.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                  {row.is_active ? 'Active' : 'Inactive'}
                </span>
                <button onClick={() => beginEdit(row)} className="p-2 rounded hover:bg-gray-100" title="Edit">
                  <Pencil className="w-4 h-4 text-gray-500" />
                </button>
                <button onClick={() => toggleActive(row)} className="p-2 rounded hover:bg-gray-100" title="Toggle status">
                  {row.is_active ? <EyeOff className="w-4 h-4 text-gray-500" /> : <Eye className="w-4 h-4 text-gray-500" />}
                </button>
                <button onClick={() => handleDelete(row.id)} className="p-2 rounded hover:bg-red-50" title="Delete">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatTopicCategoriesPanel;
