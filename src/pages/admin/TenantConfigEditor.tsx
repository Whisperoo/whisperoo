import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Save, Building2, Palette, Link, Phone, Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { TenantConfig, TenantDepartment } from '@/contexts/TenantContext';
import { useTranslation } from 'react-i18next';

interface TenantConfigEditorProps {
  tenantId: string | null;
}

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  config: TenantConfig | null;
}

const EMPTY_DEPT: TenantDepartment = { name: '', phone: '', email: '' };

const TenantConfigEditor: React.FC<TenantConfigEditorProps> = ({ tenantId }) => {
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newHospitalName, setNewHospitalName] = useState('');
  const [creating, setCreating] = useState(false);
  const { t } = useTranslation();

  // Form state mirrors TenantConfig
  const [displayName, setDisplayName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1C3263');
  const [logoUrl, setLogoUrl] = useState('');
  const [departments, setDepartments] = useState<TenantDepartment[]>([]);

  const fetchTenant = useCallback(async () => {
    if (!tenantId) { setTenant(null); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, slug, config')
        .eq('id', tenantId)
        .single();
      if (error) throw error;
      const cfg = (data.config as TenantConfig) || {};
      setTenant(data);
      setDisplayName(cfg.branding?.display_name ?? data.name ?? '');
      setPrimaryColor(cfg.branding?.primary_color ?? '#1C3263');
      setLogoUrl(cfg.branding?.logo_url ?? '');
      setDepartments(cfg.departments ?? []);
    } catch (err) {
      console.error('TenantConfigEditor: fetch error', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchTenant(); }, [fetchTenant]);

  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);
    setSaved(false);
    try {
      const currentConfig = (tenant.config || {}) as TenantConfig;
      const updatedConfig: TenantConfig = {
        ...currentConfig,
        branding: {
          ...currentConfig.branding,
          display_name: displayName,
          primary_color: primaryColor,
          logo_url: logoUrl || undefined,
        },
        departments: departments.filter((d) => d.name.trim()),
      };
      const { error } = await supabase
        .from('tenants')
        .update({ config: updatedConfig })
        .eq('id', tenant.id);
      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('TenantConfigEditor: save error', err);
    } finally {
      setSaving(false);
    }
  };

  const addDept = () => setDepartments((prev) => [...prev, { ...EMPTY_DEPT }]);
  const removeDept = (i: number) => setDepartments((prev) => prev.filter((_, idx) => idx !== i));
  const updateDept = (i: number, field: keyof TenantDepartment, val: string) =>
    setDepartments((prev) => prev.map((d, idx) => (idx === i ? { ...d, [field]: val } : d)));

  const handleCreateNewTenant = async () => {
    if (!newHospitalName.trim()) return;
    setCreating(true);
    try {
      // Auto-generate a slug from the name (lowercase, spaces to hyphens, no special chars)
      const slug = newHospitalName.trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        + '-' + Date.now().toString(36); // append unique suffix to avoid collisions

      const { data, error } = await supabase
        .from('tenants')
        .insert([{ 
          name: newHospitalName.trim(), 
          slug,
          config: {}, 
          is_active: true 
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      // Reload the page so the dropdown updates and the new hospital can be selected
      window.location.reload();
    } catch (err: any) {
      console.error('Error creating tenant:', err);
      alert(`Failed to create hospital: ${err.message || 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  };

  if (!tenantId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-800 gap-6 max-w-md mx-auto">
        <div className="flex flex-col items-center gap-2">
          <Building2 className="w-12 h-12 text-blue-500 mb-2" />
          <h2 className="text-xl font-semibold">Create New Hospital</h2>
          <p className="text-sm text-gray-500 text-center">Enter a name below to create a new hospital tenant, or select an existing one from the top dropdown.</p>
        </div>
        
        <div className="w-full flex gap-2 mt-4">
          <input
            type="text"
            value={newHospitalName}
            onChange={(e) => setNewHospitalName(e.target.value)}
            placeholder="E.g. Memorial Health System"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleCreateNewTenant}
            disabled={!newHospitalName.trim() || creating}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{t('admin.config.title')}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {t('admin.config.description')} <span className="font-medium text-gray-700">{tenant?.name}</span>.
        </p>
      </div>

      {/* ── Branding ── */}
      <section className="bg-white rounded-[16px] border border-gray-200 shadow-sm p-6 space-y-5">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Palette className="w-4 h-4 text-blue-500" /> {t('admin.config.branding')}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{t('admin.config.displayName')}</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('admin.config.displayNamePlaceholder')}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">{t('admin.config.primaryColor')}</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-gray-200 p-0.5"
              />
              <input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#1C3263"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block flex items-center gap-1">
            <Link className="w-3 h-3" /> {t('admin.config.logoUrl')}
          </label>
          <input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://..."
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {logoUrl && (
            <div className="mt-2 flex items-center gap-2">
              <img
                src={logoUrl}
                alt="Logo preview"
                className="h-10 object-contain rounded border border-gray-100"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
              <span className="text-xs text-gray-400">{t('admin.config.logoPreview')}</span>
            </div>
          )}
        </div>
      </section>

      {/* ── Departments ── */}
      <section className="bg-white rounded-[16px] border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Phone className="w-4 h-4 text-blue-500" /> {t('admin.config.departments')}
          </h3>
          <button
            onClick={addDept}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> {t('admin.config.addDepartment')}
          </button>
        </div>

        {departments.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">
            {t('admin.config.noDepartments')}
          </p>
        )}

        <div className="space-y-3">
          {departments.map((dept, i) => (
            <div
              key={i}
              className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100"
            >
              <input
                value={dept.name}
                onChange={(e) => updateDept(i, 'name', e.target.value)}
                placeholder={t('admin.config.departmentName')}
                className="text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <div className="flex items-center gap-1">
                <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <input
                  value={dept.phone ?? ''}
                  onChange={(e) => updateDept(i, 'phone', e.target.value)}
                  placeholder={t('admin.config.phoneNumber')}
                  className="flex-1 text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div className="flex items-center gap-1">
                <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <input
                  value={dept.email ?? ''}
                  onChange={(e) => updateDept(i, 'email', e.target.value)}
                  placeholder={t('admin.config.email')}
                  className="flex-1 text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <button
                  onClick={() => removeDept(i)}
                  className="ml-1 text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── QR Code Generator ── */}
      <section className="bg-white rounded-[16px] border border-gray-200 shadow-sm p-6 space-y-5">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Link className="w-4 h-4 text-blue-500" /> Hospital QR Code
        </h3>
        <p className="text-sm text-gray-500">
          Print or display this QR code in the hospital. When users scan it, they will automatically be affiliated with {tenant?.name} during signup.
        </p>
        {(() => {
          const signupUrl = `${window.location.origin}/auth/create?tenant=${tenant?.slug || tenantId}`;
          return (
            <div className="flex items-center gap-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(signupUrl)}`} 
                  alt="Hospital QR Code"
                  className="w-32 h-32"
                />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-gray-600">Signup Link:</p>
                <code className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-800 break-all">
                  {signupUrl}
                </code>
                <button
                  onClick={() => { navigator.clipboard.writeText(signupUrl); alert('Link copied!'); }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-1"
                >
                  Copy Link
                </button>
                <a 
                  href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(signupUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  Download High-Res QR Code &rarr;
                </a>
              </div>
            </div>
          );
        })()}
      </section>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end pt-4 pb-12">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? t('admin.config.saving') : t('admin.config.saveConfig')}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-emerald-600 font-medium">
            <CheckCircle2 className="w-4 h-4" /> {t('admin.config.saved')}
          </span>
        )}
      </div>
    </div>
  );
};

export default TenantConfigEditor;
