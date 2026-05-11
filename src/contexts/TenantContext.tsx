import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

export interface TenantDepartment {
  name: string;
  phone?: string;
  email?: string;
}

export interface TenantConfig {
  branding?: {
    primary_color?: string;
    logo_url?: string;
    display_name?: string;
  };
  departments?: TenantDepartment[];
  expert_boost_ids?: string[];
  disabled_product_ids?: string[];   // content curation: products hidden from this tenant's users
  /** Experts hidden from this hospital's directory, chat suggestions, and deep links */
  disabled_expert_ids?: string[];
  escalation_triggers?: string[];
  languages?: string[];
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  config: TenantConfig | null;
  is_active: boolean;
}

interface TenantContextType {
  tenant: Tenant | null;
  config: TenantConfig | null;
  isHospitalUser: boolean;
  loading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const fetchTenant = async () => {
      if (!profile?.tenant_id) {
        if (isMounted) {
          setTenant(null);
          setConfig(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', profile.tenant_id)
          .single();

        if (error) throw error;

        if (isMounted && data) {
          setTenant(data);
          // Cast config JSON to typed structure
          setConfig((data.config as unknown) as TenantConfig || null);
        }
      } catch (err) {
        console.error('Error fetching tenant:', err);
        if (isMounted) {
          setTenant(null);
          setConfig(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTenant();

    return () => {
      isMounted = false;
    };
  }, [profile?.tenant_id]);

  const value = {
    tenant,
    config,
    isHospitalUser: !!tenant,
    loading
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};
