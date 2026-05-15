import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { CANONICAL_TOPICS, hasCanonicalTopic } from '@/utils/canonicalTopics';

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
  booking_model: 'direct' | 'inquiry' | 'hospital';
  how_to_schedule: string;
  hospital_prebook_message: string;
  booking_confirmation_title: string;
  booking_confirmation_desc: string;
  /** Optional: scope hospital resource to a tenant (defaults to selected expert's tenant) */
  tenant_id: string;
}

interface ExpertOption {
  id: string;
  first_name: string;
  tenant_id?: string | null;
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
  booking_model: 'direct',
  how_to_schedule: '',
  hospital_prebook_message: '',
  booking_confirmation_title: '',
  booking_confirmation_desc: '',
  tenant_id: '',
};

const AdminProductForm: React.FC<AdminProductFormProps> = ({ productId, onClose, onSaved }) => {
  const isNew = !productId || productId === 'new';
  const [form, setForm] = useState<ProductFormData>(EMPTY_FORM);
  const [experts, setExperts] = useState<ExpertOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Fetch experts for the dropdown
      const { data: expertData } = await supabase
        .from('profiles')
        .select('id, first_name, tenant_id')
        .eq('account_type', 'expert')
        .eq('expert_verified', true)
        .order('first_name');
      setExperts(expertData ?? []);

      const { data: tenantRows } = await supabase
        .from('tenants')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      setTenants((tenantRows ?? []) as { id: string; name: string }[]);

      // If editing, fetch product data
      if (!isNew) {
        const { data, error: fetchErr } = await supabase
          .from('products')
          .select('title, description, product_type, price, is_free, file_url, thumbnail_url, expert_id, status, tags, duration_minutes, difficulty_level, is_hospital_resource, booking_model, how_to_schedule, hospital_prebook_message, booking_confirmation_title, booking_confirmation_desc, tenant_id')
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
            is_free: data.is_free ?? (data.price === 0),
            file_url: data.file_url || '',
            thumbnail_url: data.thumbnail_url || '',
            expert_id: data.expert_id || '',
            status: data.status || 'draft',
            tags: data.tags || [],
            duration_minutes: data.duration_minutes || 0,
            difficulty_level: data.difficulty_level || 'beginner',
            is_hospital_resource: data.is_hospital_resource ?? false,
            booking_model: data.booking_model || 'direct',
            how_to_schedule: data.how_to_schedule || '',
            hospital_prebook_message: data.hospital_prebook_message || '',
            booking_confirmation_title: (data as any).booking_confirmation_title || '',
            booking_confirmation_desc: (data as any).booking_confirmation_desc || '',
            tenant_id: (data as any).tenant_id || '',
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
    if (!hasCanonicalTopic(form.tags)) {
      setError('Pick at least one tag from the canonical list (so the resource shows up for users who selected that topic during onboarding).');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const uploadPublic = async (bucket: 'resource-files' | 'resource-thumbnails', file: File, prefix: string) => {
        setUploading(true);
        try {
          const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
          const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
          const path = `${prefix}/${fileName}`;

          const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
            upsert: true,
            contentType: file.type || undefined,
          });
          if (upErr) throw upErr;
          const { data } = supabase.storage.from(bucket).getPublicUrl(path);
          return data.publicUrl || null;
        } finally {
          setUploading(false);
        }
      };

      let nextFileUrl = form.file_url.trim() || null;
      let nextThumbUrl = form.thumbnail_url.trim() || null;

      if (resourceFile) {
        const prefix = `resources/${form.expert_id || 'unknown'}/${isNew ? 'new' : productId}`;
        nextFileUrl = await uploadPublic('resource-files', resourceFile, prefix);
      }
      if (thumbFile) {
        const prefix = `resources/${form.expert_id || 'unknown'}/${isNew ? 'new' : productId}`;
        nextThumbUrl = await uploadPublic('resource-thumbnails', thumbFile, prefix);
      }

      const selectedExpert = experts.find(e => e.id === form.expert_id);
      const productTenantId = form.is_hospital_resource
        ? ((form.tenant_id || '').trim() || selectedExpert?.tenant_id || null)
        : null;

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        product_type: form.product_type,
        price: form.is_free ? 0 : form.price,
        is_free: form.is_free,
        file_url: nextFileUrl,
        thumbnail_url: nextThumbUrl,
        expert_id: form.expert_id,
        status: form.status,
        tags: form.tags,
        duration_minutes: form.duration_minutes || null,
        difficulty_level: form.difficulty_level || null,
        is_hospital_resource: form.is_hospital_resource,
        booking_model: form.booking_model,
        how_to_schedule: form.booking_model === 'hospital' ? form.how_to_schedule.trim() || null : null,
        hospital_prebook_message:
          form.booking_model === 'hospital' ? form.hospital_prebook_message.trim() || null : null,
        booking_confirmation_title: form.product_type === 'consultation' ? form.booking_confirmation_title.trim() || null : null,
        booking_confirmation_desc: form.product_type === 'consultation' ? form.booking_confirmation_desc.trim() || null : null,
        tenant_id: productTenantId,
      };

      if (isNew) {
        const { error: insertErr } = await supabase.from('products').insert([payload]);
        if (insertErr) throw insertErr;
      } else {
        const { error: updateErr } = await supabase.from('products').update(payload).eq('id', productId);
        if (updateErr) throw updateErr;
      }
      toast({ title: 'Success', description: `Content successfully ${isNew ? 'created' : 'updated'}.` });
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('AdminProductForm save error:', err);
      setError(err.message || 'Failed to save');
      toast({ title: 'Save failed', description: err.message || 'Failed to save', variant: 'destructive' });
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
                  <option value="consultation">Consultation</option>
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

            {/* Hospital pilot: visible path for Super Admin */}
            <div className="rounded-xl border-2 border-indigo-200 bg-gradient-to-b from-indigo-50/90 to-white p-4 space-y-4 shadow-sm">
              <div>
                <h3 className="text-sm font-semibold text-indigo-900">Hospital programs & booking</h3>
                <p className="text-xs text-indigo-900/85 mt-1 leading-relaxed">
                  Use this section when publishing content for a hospital pilot: mark it as a Hospital Resource, optionally pick the hospital tenant (or leave default to follow the expert&apos;s hospital), then set how parents book below. Consultations can use Inquiry (expert calls the parent) or Hospital (scheduling instructions only).
                </p>
              </div>

              <div className="flex items-start gap-2 p-2 rounded-lg bg-white/80 border border-indigo-100">
                <input
                  type="checkbox"
                  id="is_hospital_resource"
                  checked={form.is_hospital_resource}
                  onChange={(e) => {
                    const isHospital = e.target.checked;
                    setForm({
                      ...form,
                      is_hospital_resource: isHospital,
                      booking_model: isHospital ? 'hospital' : form.booking_model === 'hospital' ? 'direct' : form.booking_model,
                      is_free: isHospital ? true : form.is_free,
                      price: isHospital ? 0 : form.price,
                      tenant_id: isHospital ? form.tenant_id : '',
                    });
                  }}
                  className="w-4 h-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="is_hospital_resource" className="text-sm text-gray-800 leading-snug">
                  <span className="font-medium">Hospital Resource</span>
                  <span className="text-gray-600"> — counts toward hospital utilization; use with a hospital-affiliated expert or pick a tenant below.</span>
                </label>
              </div>

              {form.is_hospital_resource && tenants.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-indigo-900 mb-1 block">Hospital tenant (optional)</label>
                  <select
                    value={form.tenant_id}
                    onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}
                    className="w-full text-sm border border-indigo-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">Auto — use selected expert&apos;s hospital tenant</option>
                    {tenants.map((tn) => (
                      <option key={tn.id} value={tn.id}>{tn.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-indigo-800/80 mt-1">Override when this item should roll up under a specific hospital even if the expert record differs.</p>
                </div>
              )}

              {(form.product_type === 'consultation' || form.is_hospital_resource) && (
                <div className="p-4 bg-white rounded-lg border border-indigo-100 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-indigo-900 mb-1 block">Booking model</label>
                    <select
                      value={form.booking_model}
                      onChange={(e) => {
                        const model = e.target.value as 'direct' | 'inquiry' | 'hospital';
                        setForm({
                          ...form,
                          booking_model: model,
                          is_free: model !== 'direct' ? true : form.is_free,
                          price: model !== 'direct' ? 0 : form.price,
                          is_hospital_resource: model === 'hospital' ? true : form.is_hospital_resource,
                        });
                      }}
                      className="w-full text-sm border border-indigo-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="direct">Direct (pay in app via Stripe)</option>
                      <option value="inquiry">Inquiry (no payment — expert contacts parent)</option>
                      <option value="hospital">Hospital (custom scheduling instructions)</option>
                    </select>
                    <p className="text-xs text-indigo-800/90 mt-1">
                      {form.booking_model === 'direct' && 'Parent pays in the app; use for paid consultations.'}
                      {form.booking_model === 'inquiry' && 'Free request flow; expert reaches out. Pairs with expert profile inquiry messages.'}
                      {form.booking_model === 'hospital' && 'Shows your pre-book and “how to schedule” copy; mark Hospital Resource above.'}
                    </p>
                  </div>

                  {form.booking_model === 'hospital' && (
                    <>
                      <div>
                        <label className="text-xs font-semibold text-indigo-900 mb-1 block">Pre-book message (optional)</label>
                        <textarea
                          value={form.hospital_prebook_message}
                          onChange={(e) => setForm({ ...form, hospital_prebook_message: e.target.value })}
                          placeholder="Optional override before parents confirm. Default describes 48-hour outreach."
                          rows={3}
                          className="w-full text-sm border border-indigo-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-indigo-900 mb-1 block">How to schedule (after confirm)</label>
                        <textarea
                          value={form.how_to_schedule}
                          onChange={(e) => setForm({ ...form, how_to_schedule: e.target.value })}
                          placeholder="e.g. Call Labor & Delivery at 555-1234 to schedule."
                          rows={3}
                          className="w-full text-sm border border-indigo-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-white"
                        />
                      </div>
                    </>
                  )}

                  {/* Confirmation page headline — applies to all consultation booking models */}
                  <div className="border-t border-indigo-100 pt-4 space-y-3">
                    <p className="text-xs font-semibold text-indigo-900">Confirmation page message (optional)</p>
                    <p className="text-xs text-indigo-800/80">Override the title and description shown at the top of the success screen after booking. Leave blank to use the default text.</p>
                    <div>
                      <label className="text-xs font-medium text-indigo-900 mb-1 block">Headline</label>
                      <input
                        value={form.booking_confirmation_title}
                        onChange={(e) => setForm({ ...form, booking_confirmation_title: e.target.value })}
                        placeholder='e.g. "Your lactation session is confirmed! 🎉"'
                        className="w-full text-sm border border-indigo-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-indigo-900 mb-1 block">Sub-headline</label>
                      <textarea
                        value={form.booking_confirmation_desc}
                        onChange={(e) => setForm({ ...form, booking_confirmation_desc: e.target.value })}
                        placeholder='e.g. "Franice will reach out within 2 hours to set a time."'
                        rows={2}
                        className="w-full text-sm border border-indigo-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}
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

            {/* URLs / Uploads (not applicable to consultations) */}
            {form.product_type !== 'consultation' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">File (upload or URL)</label>
                  <input
                    type="file"
                    onChange={(e) => setResourceFile(e.target.files?.[0] || null)}
                    className="w-full text-sm mb-2"
                  />
                  <input
                    value={form.file_url}
                    onChange={(e) => setForm({ ...form, file_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Thumbnail (upload or URL)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setThumbFile(e.target.files?.[0] || null)}
                    className="w-full text-sm mb-2"
                  />
                  <input
                    value={form.thumbnail_url}
                    onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Tags */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Tags (Quick Select)</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {CANONICAL_TOPICS.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (form.tags.includes(tag)) {
                        removeTag(tag);
                      } else {
                        addTag(tag);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      form.tags.includes(tag) 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                        : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-600 hover:text-indigo-600'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <label className="text-xs font-medium text-gray-600 mb-1 block">Custom Tags</label>
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
                placeholder="Type a custom tag and press Enter"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if ((e.target as HTMLInputElement).value.trim()) {
                      addTag((e.target as HTMLInputElement).value.trim());
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                }}
              />
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
            disabled={saving || loading || uploading}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {(saving || uploading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isNew ? 'Create Content' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminProductForm;
