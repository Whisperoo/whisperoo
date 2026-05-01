import React, { useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';

interface Tenant {
  id: string;
  name: string;
  region?: string;
}

interface HospitalSelectorProps {
  selectedTenantId: string | null;
  onTenantChange: (tenantId: string | null) => void;
}

const HospitalSelector: React.FC<HospitalSelectorProps> = ({ selectedTenantId, onTenantChange }) => {
  const { t } = useTranslation();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from('tenants')
      .select('id, name, config')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (data) {
          setTenants(
            data.map((t) => ({
              id: t.id,
              name: t.name,
              region: (t.config as Record<string, string>)?.region,
            }))
          );
        }
      });
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = selectedTenantId
    ? tenants.find((t) => t.id === selectedTenantId)
    : null;

  const displayName = selected ? selected.name : t('admin.hospital.allHospitals');
  const displayRegion = selected?.region ?? t('admin.hospital.aggregateView');

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm hover:border-gray-300 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-blue-600" />
        </div>
        <div className="text-left">
          <p className="font-semibold text-gray-900 leading-tight text-sm">{displayName}</p>
          <p className="text-xs text-gray-500 leading-tight mt-0.5">{displayRegion}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[240px] py-1 overflow-hidden">
          {/* All Hospitals option */}
          <button
            onClick={() => { onTenantChange(null); setOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-6 h-6 rounded bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">{t('admin.hospital.allHospitals')}</p>
              <p className="text-xs text-gray-500">{t('admin.hospital.aggregateView')}</p>
            </div>
            {selectedTenantId === null && <Check className="w-4 h-4 text-blue-600" />}
          </button>

          {tenants.length > 0 && (
            <div className="border-t border-gray-100 my-1" />
          )}

          {tenants.map((tenant) => (
            <button
              key={tenant.id}
              onClick={() => { onTenantChange(tenant.id); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-6 h-6 rounded bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{tenant.name}</p>
                {tenant.region && <p className="text-xs text-gray-500">{tenant.region}</p>}
              </div>
              {selectedTenantId === tenant.id && <Check className="w-4 h-4 text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default HospitalSelector;
