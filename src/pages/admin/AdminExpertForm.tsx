import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { regenerateExpertEmbedding } from '@/services/expertEmbeddings';
import { CANONICAL_TOPICS, hasCanonicalTopic } from '@/utils/canonicalTopics';

const COMMON_SPECIALTIES = CANONICAL_TOPICS;

const COMMON_CREDENTIALS = [
  'Licensed Family Therapist (LFT)', 'Licensed Clinical Social Worker (LCSW)',
  'Licensed Professional Counselor (LPC)', 'Licensed Marriage and Family Therapist (LMFT)',
  'Board Certified Pediatrician', 'Registered Nurse (RN)',
  'Certified Lactation Consultant', 'Certified Parenting Coach',
  'Child Development Associate (CDA)', 'Child Development Specialist',
  "Master's in Child Psychology", 'PhD in Developmental Psychology',
  'Certified Sleep Consultant', 'Certified Pediatric Sleep Consultant',
  'International Board Certified Lactation Consultant (IBCLC)',
];

interface AdminExpertFormProps {
  expertId: string | null; // null = create new, string = edit existing
  onClose: () => void;
  onSaved: () => void;
}

interface ExpertFormData {
  first_name: string;
  email: string;
  password: string;
  profile_image_url: string;
  expert_bio: string;
  inquiry_confirmation_message: string;
  inquiry_prebook_message: string;
  expert_specialties: string[];
  expert_credentials: string[];
  expert_experience_years: number;
  expert_consultation_rate: number;
  expert_availability_status: string;
  tenant_id: string | null;
}

const EMPTY_FORM: ExpertFormData = {
  first_name: '',
  email: '',
  password: '',
  profile_image_url: '',
  expert_bio: '',
  inquiry_confirmation_message: '',
  inquiry_prebook_message: '',
  expert_specialties: [],
  expert_credentials: [],
  expert_experience_years: 0,
  expert_consultation_rate: 0,
  expert_availability_status: 'available',
  tenant_id: null,
};

const AdminExpertForm: React.FC<AdminExpertFormProps> = ({ expertId, onClose, onSaved }) => {
  const isNew = expertId === 'new';
  const { t } = useTranslation();
  const [form, setForm] = useState<ExpertFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [newCredential, setNewCredential] = useState('');
  const [tenants, setTenants] = useState<any[]>([]);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadWarning, setImageUploadWarning] = useState<string | null>(null);

  // Load tenants
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('tenants').select('id, name').order('name');
      if (data) setTenants(data);
    })();
  }, []);

  // Load existing expert data
  useEffect(() => {
    if (isNew) return;
    (async () => {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', expertId)
        .single();
      if (fetchErr) {
        setError(fetchErr.message);
      } else if (data) {
        setForm({
          first_name: data.first_name || '',
          email: data.email || '',
          password: '',
          profile_image_url: data.profile_image_url || '',
          expert_bio: data.expert_bio || '',
          inquiry_confirmation_message: data.inquiry_confirmation_message || '',
          inquiry_prebook_message: data.inquiry_prebook_message || '',
          expert_specialties: data.expert_specialties || [],
          expert_credentials: data.expert_credentials || [],
          expert_experience_years: data.expert_experience_years || 0,
          expert_consultation_rate: data.expert_consultation_rate || 0,
          expert_availability_status: data.expert_availability_status || 'available',
          tenant_id: data.tenant_id || null,
        });
      }
      setLoading(false);
    })();
  }, [expertId, isNew]);

  const handleSave = async () => {
    if (!form.first_name.trim()) {
      setError('Name is required');
      return;
    }
    if (isNew && !form.email.trim()) {
      setError('Email is required');
      return;
    }
    if (isNew && form.password.trim().length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    const proposedSpecialties = form.expert_specialties.length > 0
      ? form.expert_specialties
      : (newSpecialty ? [newSpecialty] : []);
    if (!hasCanonicalTopic(proposedSpecialties)) {
      setError('Pick at least one specialty from the canonical list (so this expert shows up for users who selected that topic during onboarding).');
      return;
    }
    setSaving(true);
    setError(null);
    setImageUploadWarning(null);

    const finalSpecialties = form.expert_specialties.length > 0 
      ? form.expert_specialties 
      : (newSpecialty ? [newSpecialty] : []);
    
    const finalCredentials = form.expert_credentials.length > 0
      ? form.expert_credentials
      : (newCredential ? [newCredential] : []);

    try {
      // Note: do not pre-check `profiles.email` (HIPAA migration removed it).
      // We rely on the RPC + auth.users unique email constraint for conflicts.
      const normalizedEmail = isNew ? form.email.trim().toLowerCase() : form.email.trim();

      const uploadProfileImage = async (targetUserId: string): Promise<string | null> => {
        if (!profileImageFile) return null;
        setUploadingImage(true);
        try {
          const ext = (profileImageFile.name.split('.').pop() || 'jpg').toLowerCase();
          const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
          const path = `experts/${targetUserId}/${fileName}`;

          const { error: upErr } = await supabase.storage
            .from('expert-images')
            .upload(path, profileImageFile, {
              upsert: true,
              contentType: profileImageFile.type || undefined,
            });
          if (upErr) throw upErr;

          const { data } = supabase.storage.from('expert-images').getPublicUrl(path);
          return data.publicUrl || null;
        } finally {
          setUploadingImage(false);
        }
      };

      let savedExpertId: string | null = null;

      if (isNew) {
        // Must use server-side function because profiles.id is FK to auth.users
        const { data: newId, error: rpcErr } = await supabase.rpc('fn_admin_create_expert', {
          p_first_name: form.first_name.trim(),
          p_email: normalizedEmail || null,
          p_profile_image_url: null,
          p_expert_bio: form.expert_bio.trim() || null,
          p_expert_specialties: finalSpecialties,
          p_expert_credentials: finalCredentials,
          p_expert_experience_years: form.expert_experience_years,
          p_expert_consultation_rate: form.expert_consultation_rate,
          p_expert_availability_status: form.expert_availability_status,
          p_tenant_id: form.tenant_id,
          p_password: form.password.trim() || null,
          p_inquiry_confirmation_message: form.inquiry_confirmation_message.trim() || null,
          p_inquiry_prebook_message: form.inquiry_prebook_message.trim() || null,
        });
        if (rpcErr) throw rpcErr;

        const createdId = (newId as unknown as string) || null;
        savedExpertId = createdId;
        if (createdId) {
          let uploadedUrl: string | null = null;
          try {
            uploadedUrl = await uploadProfileImage(createdId);
          } catch (upErr: any) {
            const warn =
              upErr?.message ||
              'Expert was created, but profile image upload failed. You can retry from Edit Expert.';
            setImageUploadWarning(warn);
          }

          const finalUrl = uploadedUrl || form.profile_image_url.trim() || null;
          if (finalUrl) {
            const { error: updateErr } = await supabase
              .from('profiles')
              .update({ profile_image_url: finalUrl })
              .eq('id', createdId);
            if (updateErr) throw updateErr;
          }
        }
      } else {
        savedExpertId = expertId as string;
        let uploadedUrl: string | null = null;
        try {
          uploadedUrl = await uploadProfileImage(expertId as string);
        } catch (upErr: any) {
          const warn =
            upErr?.message ||
            'Profile was updated, but image upload failed. You can retry image upload.';
          setImageUploadWarning(warn);
        }

        const nextUrl = uploadedUrl ?? (form.profile_image_url.trim() || null);
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({
            first_name: form.first_name.trim(),
            profile_image_url: nextUrl,
            expert_bio: form.expert_bio.trim(),
            inquiry_confirmation_message: form.inquiry_confirmation_message.trim() || null,
            inquiry_prebook_message: form.inquiry_prebook_message.trim() || null,
            expert_specialties: finalSpecialties,
            expert_credentials: finalCredentials,
            expert_experience_years: form.expert_experience_years,
            expert_consultation_rate: form.expert_consultation_rate,
            expert_availability_status: form.expert_availability_status,
            tenant_id: form.tenant_id,
          })
          .eq('id', expertId);
        if (updateErr) throw updateErr;
      }

      if (savedExpertId) {
        try {
          await regenerateExpertEmbedding(savedExpertId);
        } catch (embeddingErr) {
          console.error('Failed to regenerate expert embedding:', embeddingErr);
          toast({
            title: 'Expert saved, embedding refresh failed',
            description: 'The profile was saved, but recommendations may take longer to update.',
            variant: 'destructive',
          });
        }
      }
      toast({ title: 'Success', description: `Expert successfully ${isNew ? 'added' : 'updated'}.` });
      onSaved();
      onClose();
    } catch (err: any) {
      let msg = err?.message || 'Failed to save';
      if (typeof msg === 'string' && msg.includes('users_email_partial_key')) {
        msg = 'Email already exists. Use a different email, or edit the existing expert.';
      }
      setError(msg);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const addChip = (list: string[], item: string, setter: (v: string[]) => void) => {
    if (item.trim() && !list.includes(item.trim())) {
      setter([...list, item.trim()]);
    }
  };

  const removeChip = (list: string[], item: string, setter: (v: string[]) => void) => {
    setter(list.filter((i) => i !== item));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {isNew ? 'Add New Expert' : 'Edit Expert'}
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
            {imageUploadWarning && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {imageUploadWarning}
              </div>
            )}

            {/* Name & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Full Name *</label>
                <input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  placeholder="Dr. Sarah Johnson"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Email {isNew ? '*' : ''}</label>
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="expert@example.com"
                  disabled={!isNew}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
            </div>

            {isNew && (
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Password *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Set expert login password"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Tenant Affiliation */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Affiliation (Tenant)</label>
              <select
                value={form.tenant_id || ''}
                onChange={(e) => setForm({ ...form, tenant_id: e.target.value || null })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Whisperoo General Expert (No Hospital)</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Profile Image URL */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Profile Image</label>
              <div className="flex items-center gap-3">
                {form.profile_image_url && (
                  <img src={form.profile_image_url} alt="" className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setProfileImageFile(file);
                    if (file) {
                      const tempUrl = URL.createObjectURL(file);
                      setForm({ ...form, profile_image_url: tempUrl });
                    }
                  }}
                  className="flex-1 text-sm"
                />
              </div>
              <div className="mt-2">
                <input
                  value={form.profile_image_url}
                  onChange={(e) => setForm({ ...form, profile_image_url: e.target.value })}
                  placeholder="https://..."
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Professional Bio</label>
              <textarea
                value={form.expert_bio}
                onChange={(e) => setForm({ ...form, expert_bio: e.target.value })}
                placeholder="Tell parents about this expert's background, experience, and approach..."
                rows={4}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">{form.expert_bio.length} characters</p>
            </div>

            {/* Flat-rate consultation purchase note (direct booking) */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Consultation Purchase Note
                <span className="text-gray-400 ml-1">(optional)</span>
              </label>
              <textarea
                value={form.inquiry_prebook_message}
                onChange={(e) => setForm({ ...form, inquiry_prebook_message: e.target.value })}
                placeholder="Custom note shown to users after they purchase a paid consultation. Example: 'Thank you for booking. Your expert will follow up shortly with appointment details.'"
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                Used for direct consultation purchases. Leave blank to show the default purchase success instructions.
              </p>
            </div>

            {/* Appointment request confirmation message */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Appointment Request Confirmation Message
                <span className="text-gray-400 ml-1">(optional)</span>
              </label>
              <textarea
                value={form.inquiry_confirmation_message}
                onChange={(e) => setForm({ ...form, inquiry_confirmation_message: e.target.value })}
                placeholder="Custom message shown to users after they request an appointment. Example: 'Thank you for your request! I typically respond within 24 hours.'"
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                This message appears after a user submits an inquiry request. Leave blank for the default confirmation text.
              </p>
            </div>

            {/* Specialties */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Specialties</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.expert_specialties.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-1 rounded-full">
                    {s}
                    <button onClick={() => removeChip(form.expert_specialties, s, (v) => setForm({ ...form, expert_specialties: v }))} className="hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      addChip(form.expert_specialties, val, (v) => setForm({ ...form, expert_specialties: v }));
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary h-10"
                >
                  <option value="">{t('admin.experts.selectSpecialty', 'Select a specialty...')}</option>
                  {COMMON_SPECIALTIES.filter((s) => !form.expert_specialties.includes(s)).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={() => { addChip(form.expert_specialties, newSpecialty, (v) => setForm({ ...form, expert_specialties: v })); setNewSpecialty(''); }}
                  disabled={!newSpecialty}
                  className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 disabled:opacity-40 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <input
                placeholder="Or type a custom specialty and press Enter"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addChip(form.expert_specialties, (e.target as HTMLInputElement).value, (v) => setForm({ ...form, expert_specialties: v }));
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
            </div>

            {/* Credentials */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Credentials</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.expert_credentials.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-medium px-2 py-1 rounded-full">
                    {c}
                    <button onClick={() => removeChip(form.expert_credentials, c, (v) => setForm({ ...form, expert_credentials: v }))} className="hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      addChip(form.expert_credentials, val, (v) => setForm({ ...form, expert_credentials: v }));
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary h-10"
                >
                  <option value="">{t('admin.experts.selectCredential', 'Select a credential...')}</option>
                  {COMMON_CREDENTIALS.filter((c) => !form.expert_credentials.includes(c)).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button
                  onClick={() => { addChip(form.expert_credentials, newCredential, (v) => setForm({ ...form, expert_credentials: v })); setNewCredential(''); }}
                  disabled={!newCredential}
                  className="px-3 py-2 bg-green-50 text-green-600 rounded-lg text-sm font-medium hover:bg-green-100 disabled:opacity-40 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <input
                placeholder="Or type a custom credential and press Enter"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addChip(form.expert_credentials, (e.target as HTMLInputElement).value, (v) => setForm({ ...form, expert_credentials: v }));
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
            </div>

            {/* Numbers Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Years of Experience</label>
                <input
                  type="number"
                  min={0}
                  value={form.expert_experience_years}
                  onChange={(e) => setForm({ ...form, expert_experience_years: parseInt(e.target.value) || 0 })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Rate ($/hour)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.expert_consultation_rate}
                  onChange={(e) => setForm({ ...form, expert_consultation_rate: parseFloat(e.target.value) || 0 })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Availability */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Availability Status</label>
              <select
                value={form.expert_availability_status}
                onChange={(e) => setForm({ ...form, expert_availability_status: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="available">Available</option>
                <option value="busy">Busy</option>
                <option value="unavailable">Unavailable</option>
              </select>
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
            disabled={saving || loading || uploadingImage}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {(saving || uploadingImage) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isNew ? 'Create Expert' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminExpertForm;
