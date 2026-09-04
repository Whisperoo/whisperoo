import React, { useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown, Check, Globe, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';

interface Tenant {
  id: string;
  name: string;
  region?: string;
}

/**
 * Audience segment, matching the p_segment argument on the dashboard RPCs.
 * Mirrors the DashboardSegment union in MetricsDash.
 */
export type AdminSegment = 'all' | 'hospital' | 'b2c';

interface HospitalSelectorProps {
  selectedTenantId: string | null;
  selectedSegment: AdminSegment;
  onScopeChange: (tenantId: string | null, segment: AdminSegment) => void;
}

/**
 * Single scope selector: who the admin portal is currently reporting on.
 *
 * This used to be a hospital picker whose "All Hospitals" option was widely
 * misread. It never meant "hospital users only" -- it passed p_tenant_id = NULL,
 * which matches every row, so hospital-affiliated and direct signups were silently
 * mixed together. The segment filter added in 20260822000001 made the distinction
 * expressible, but as a second dropdown it also made a contradiction expressible:
 * one specific hospital AND "B2C", which the RPCs resolve by ignoring the hospital.
 *
 * Merging the two into one list removes that by construction -- the impossible
 * combination simply has no entry -- and scales as more hospitals are added:
 *
 *   Platform overall     tenant = null, segment = all       everyone
 *   All hospitals        tenant = null, segment = hospital  affiliated only
 *   Direct signups       tenant = null, segment = b2c       unaffiliated only
 *   -------------------
 *   <each hospital>      tenant = id,   segment = all       that hospital
 */
const HospitalSelector: React.FC<HospitalSelectorProps> = ({
  selectedTenantId,
  selectedSegment,
  onScopeChange,
}) => {
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

  const selected = selectedTenantId ? tenants.find((t) => t.id === selectedTenantId) : null;

  // The three platform-wide scopes, above the hospital list.
  const globalScopes: Array<{
    segment: AdminSegment;
    label: string;
    sublabel: string;
    Icon: typeof Globe;
    tone: string;
  }> = [
    {
      segment: 'all',
      label: t('admin.hospital.scope.platformLabel'),
      sublabel: t('admin.hospital.scope.platformSub'),
      Icon: Globe,
      tone: 'bg-slate-50 text-slate-600',
    },
    {
      segment: 'hospital',
      label: t('admin.hospital.scope.hospitalsLabel'),
      sublabel: t('admin.hospital.scope.hospitalsSub'),
      Icon: Building2,
      tone: 'bg-blue-50 text-blue-600',
    },
    {
      segment: 'b2c',
      label: t('admin.hospital.scope.directLabel'),
      sublabel: t('admin.hospital.scope.directSub'),
      Icon: User,
      tone: 'bg-emerald-50 text-emerald-600',
    },
  ];

  const activeGlobal = !selectedTenantId
    ? globalScopes.find((s) => s.segment === selectedSegment) ?? globalScopes[0]
    : null;

  const displayName = selected ? selected.name : activeGlobal!.label;
  const displaySub = selected
    ? selected.region ?? t('admin.hospital.scope.singleHospitalSub')
    : activeGlobal!.sublabel;
  const HeaderIcon = selected ? Building2 : activeGlobal!.Icon;
  const headerTone = selected ? 'bg-indigo-50 text-indigo-600' : activeGlobal!.tone;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm hover:border-gray-300 transition-colors w-full"
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${headerTone}`}>
          <HeaderIcon className="w-4 h-4" />
        </div>
        <div className="text-left min-w-0">
          <p className="font-semibold text-gray-900 leading-tight text-sm truncate">{displayName}</p>
          <p className="text-xs text-gray-500 leading-tight mt-0.5 truncate">{displaySub}</p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 ml-auto flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[260px] py-1 overflow-hidden"
        >
          {globalScopes.map(({ segment, label, sublabel, Icon, tone }) => (
            <button
              key={segment}
              role="option"
              aria-selected={!selectedTenantId && selectedSegment === segment}
              onClick={() => { onScopeChange(null, segment); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
            >
              <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${tone}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-500">{sublabel}</p>
              </div>
              {!selectedTenantId && selectedSegment === segment && (
                <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
              )}
            </button>
          ))}

          {tenants.length > 0 && (
            <>
              <div className="border-t border-gray-100 mt-1 mb-1" />
              <p className="px-3 pt-1 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">
                {t('admin.hospital.scope.hospitalsHeading')}
              </p>
            </>
          )}

          {tenants.map((tenant) => (
            <button
              key={tenant.id}
              role="option"
              aria-selected={selectedTenantId === tenant.id}
              // A specific hospital is always segment 'all': narrowing to one tenant
              // already excludes unaffiliated users, so 'hospital' would be redundant
              // and 'b2c' would contradict the choice.
              onClick={() => { onScopeChange(tenant.id, 'all'); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-6 h-6 rounded bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{tenant.name}</p>
                {tenant.region && <p className="text-xs text-gray-500 truncate">{tenant.region}</p>}
              </div>
              {selectedTenantId === tenant.id && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default HospitalSelector;
