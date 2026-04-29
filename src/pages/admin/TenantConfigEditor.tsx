import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Save, Building2, Palette, Link, Phone, Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { TenantConfig, TenantDepartment } from '@/contexts/TenantContext';

interface TenantConfigEditorProps {
  tenantId: string | null;
}

interface TenantRow {
  id: string;
  name: string;
  config: TenantConfig | null;
}

const EMPTY_DEPT: TenantDepartment = { name: '', phone: '', email: '' };

const TenantConfigEditor: React.FC<TenantConfigEditorProps> = ({ tenantId }) => {
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
        .select('id, name, config')
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

  if (!tenantId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-3">
        <Building2 className="w-10 h-10 opacity-30" />
        <p className="text-sm">Select a hospital to edit its configuration.</p>
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
        <h2 className="text-lg font-semibold text-gray-900">Hospital Configuration</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage branding and department contacts for <span className="font-medium text-gray-700">{tenant?.name}</span>.
        </p>
      </div>

      {/* ── Branding ── */}
      <section className="bg-white rounded-[16px] border border-gray-200 shadow-sm p-6 space-y-5">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Palette className="w-4 h-4 text-blue-500" /> Branding
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Display Name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. St. Mary's Medical Center"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Brand Primary Color</label>
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
            <Link className="w-3 h-3" /> Logo URL
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
              <span className="text-xs text-gray-400">Preview</span>
            </div>
          )}
        </div>
      </section>

      {/* ── Departments ── */}
      <section className="bg-white rounded-[16px] border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Phone className="w-4 h-4 text-blue-500" /> Department Contacts
          </h3>
          <button
            onClick={addDept}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Department
          </button>
        </div>

        {departments.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">
            No departments configured. Add one to show contact info on expert profiles.
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
                placeholder="Department name"
                className="text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <div className="flex items-center gap-1">
                <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <input
                  value={dept.phone ?? ''}
                  onChange={(e) => updateDept(i, 'phone', e.target.value)}
                  placeholder="Phone number"
                  className="flex-1 text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div className="flex items-center gap-1">
                <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <input
                  value={dept.email ?? ''}
                  onChange={(e) => updateDept(i, 'email', e.target.value)}
                  placeholder="Email"
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

      {/* ── Save ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Configuration'}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-emerald-600 font-medium">
            <CheckCircle2 className="w-4 h-4" /> Saved!
          </span>
        )}
      </div>
    </div>
  );
};

export default TenantConfigEditor;
