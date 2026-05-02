import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AdminProductFormProps {
  productId: string | null; // null or 'new' = create, string = edit
  onClose: () => void;
  onSaved: () => void;
}

interface ProductFormData {
  title: string;
  description: string;
  product_type: string;
  price: number;
  is_free: boolean;
  file_url: string;
  thumbnail_url: string;
  expert_id: string;
  status: string;
  tags: string[];
  duration_minutes: number;
  difficulty_level: string;
  is_hospital_resource: boolean;
}

interface ExpertOption {
  id: string;
  first_name: string;
}

const EMPTY_FORM: ProductFormData = {
  title: '',
  description: '',
  product_type: 'document',
  price: 0,
  is_free: true,
  file_url: '',
  thumbnail_url: '',
  expert_id: '',
  status: 'published',
  tags: [],
  duration_minutes: 0,
  difficulty_level: 'beginner',
  is_hospital_resource: false,
};

const AdminProductForm: React.FC<AdminProductFormProps> = ({ productId, onClose, onSaved }) => {
  const isNew = !productId || productId === 'new';
  const [form, setForm] = useState<ProductFormData>(EMPTY_FORM);
  const [experts, setExperts] = useState<ExpertOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Fetch experts for the dropdown
      const { data: expertData } = await supabase
        .from('profiles')
        .select('id, first_name')
        .eq('account_type', 'expert')
        .eq('expert_verified', true)
        .order('first_name');
      setExperts(expertData ?? []);

      // If editing, fetch product data
      if (!isNew) {
        const { data, error: fetchErr } = await supabase
          .from('products')
          .select('title, description, product_type, price, is_free, file_url, thumbnail_url, expert_id, status, tags, duration_minutes, difficulty_level, is_hospital_resource')
          .eq('id', productId)
          .single();
        if (fetchErr) {
          setError(fetchErr.message);
        } else if (data) {
          setForm({
            title: data.title || '',
            description: data.description || '',
            product_type: data.product_type || 'document',
            price: data.price || 0,
            is_free: data.is_free ?? true,
            file_url: data.file_url || '',
            thumbnail_url: data.thumbnail_url || '',
            expert_id: data.expert_id || '',
            status: data.status || 'draft',
            tags: data.tags || [],
            duration_minutes: data.duration_minutes || 0,
            difficulty_level: data.difficulty_level || 'beginner',
            is_hospital_resource: data.is_hospital_resource ?? false,
          });
        }
      }
      setLoading(false);
    })();
  }, [productId, isNew]);

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!form.expert_id) {
      setError('Please select an expert');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      product_type: form.product_type,
      price: form.is_free ? 0 : form.price,
      is_free: form.is_free,
      file_url: form.file_url.trim() || null,
      thumbnail_url: form.thumbnail_url.trim() || null,
      expert_id: form.expert_id,
      status: form.status,
      tags: form.tags,
      duration_minutes: form.duration_minutes || null,
      difficulty_level: form.difficulty_level || null,
      is_hospital_resource: form.is_hospital_resource,
    };

    try {
      if (isNew) {
        const { error: insertErr } = await supabase.from('products').insert([payload]);
        if (insertErr) throw insertErr;
      } else {
        const { error: updateErr } = await supabase.from('products').update(payload).eq('id', productId);
        if (updateErr) throw updateErr;
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const addTag = (tag: string) => {
    if (tag.trim() && !form.tags.includes(tag.trim())) {
      setForm({ ...form, tags: [...form.tags, tag.trim()] });
    }
  };

  const removeTag = (tag: string) => {
    setForm({ ...form, tags: form.tags.filter((t) => t !== tag) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {isNew ? 'Add New Content' : 'Edit Content'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {/* Title */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="E.g. Breastfeeding Basics: A Complete Guide"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="A detailed description of this resource..."
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Type & Status Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
                <select
                  value={form.product_type}
                  onChange={(e) => setForm({ ...form, product_type: e.target.value })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="document">Document</option>
                  <option value="video">Video</option>
                  <option value="audio">Audio</option>
                  <option value="course">Course</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Difficulty</label>
                <select
                  value={form.difficulty_level}
                  onChange={(e) => setForm({ ...form, difficulty_level: e.target.value })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>

            {/* Expert Selector */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Expert Author *</label>
              <select
                value={form.expert_id}
                onChange={(e) => setForm({ ...form, expert_id: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select an expert...</option>
                {experts.map((e) => (
                  <option key={e.id} value={e.id}>{e.first_name}</option>
                ))}
              </select>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_free"
                  checked={form.is_free}
                  onChange={(e) => setForm({ ...form, is_free: e.target.checked, price: e.target.checked ? 0 : form.price })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="is_free" className="text-sm text-gray-700">Free Resource</label>
              </div>
              {!form.is_free && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Price ($)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Duration (min)</label>
                <input
                  type="number"
                  min={0}
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 0 })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* URLs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">File URL</label>
                <input
                  value={form.file_url}
                  onChange={(e) => setForm({ ...form, file_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Thumbnail URL</label>
                <input
                  value={form.thumbnail_url}
                  onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Tags</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-medium px-2 py-1 rounded-full">
                    {t}
                    <button onClick={() => removeTag(t)} className="hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <input
                placeholder="Type a tag and press Enter"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
            </div>

            {/* Hospital Resource Flag */}
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <input
                type="checkbox"
                id="is_hospital_resource"
                checked={form.is_hospital_resource}
                onChange={(e) => setForm({ ...form, is_hospital_resource: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="is_hospital_resource" className="text-sm text-gray-700">
                Mark as <span className="font-medium">Hospital Resource</span> — will appear in hospital resource utilization metrics
              </label>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isNew ? 'Create Content' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminProductForm;
