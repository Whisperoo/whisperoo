import React, { useEffect, useState, useCallback } from 'react';
import { Star, Loader2, Users, Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { TenantConfig } from '@/contexts/TenantContext';
import { useTranslation } from 'react-i18next';
import AdminExpertForm from './AdminExpertForm';
import { toast } from '@/hooks/use-toast';

interface ExpertCurationPanelProps {
  tenantId: string | null;
}

interface Expert {
  id: string;
  first_name: string;
  expert_specialties: string[] | null;
  profile_image_url: string | null;
  expert_rating: number | null;
  expert_experience_years: number | null;
  expert_availability_status: string | null;
}

const ExpertCurationPanel: React.FC<ExpertCurationPanelProps> = ({ tenantId }) => {
  const [experts, setExperts] = useState<Expert[]>([]);
  const [boostIds, setBoostIds] = useState<string[]>([]);
  const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingExpert, setEditingExpert] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { t } = useTranslation();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: expertData, error: expertError } = await supabase
        .from('profiles')
        .select('id, first_name, expert_specialties, profile_image_url, expert_rating, expert_experience_years, expert_availability_status')
        .eq('account_type', 'expert')
        .eq('expert_verified', true)
        .order('expert_rating', { ascending: false });
      if (expertError) throw expertError;
      setExperts(expertData ?? []);

      if (tenantId) {
        const { data: tenantRow, error: tenantError } = await supabase
          .from('tenants')
          .select('config')
          .eq('id', tenantId)
          .single();
        if (tenantError) throw tenantError;
        const cfg = (tenantRow?.config as TenantConfig) ?? {};
        setTenantConfig(cfg);
        setBoostIds(cfg.expert_boost_ids ?? []);
      } else {
        setBoostIds([]);
        setTenantConfig(null);
      }
    } catch (err) {
      console.error('ExpertCurationPanel: fetch error', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to load experts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggleBoost = async (expertId: string) => {
    if (!tenantId || !tenantConfig) return;
    setTogglingId(expertId);
    const isBoosted = boostIds.includes(expertId);
    const newBoostIds = isBoosted
      ? boostIds.filter((id) => id !== expertId)
      : [...boostIds, expertId];

    const updatedConfig: TenantConfig = { ...tenantConfig, expert_boost_ids: newBoostIds };
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ config: updatedConfig })
        .eq('id', tenantId);
      if (error) throw error;
      setBoostIds(newBoostIds);
      setTenantConfig(updatedConfig);
    } catch (err) {
      console.error('ExpertCurationPanel: toggle error', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update featured experts',
        variant: 'destructive',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (expertId: string) => {
    if (!confirm('Are you sure you want to delete this expert? This will also remove all their associated products.')) return;
    setDeletingId(expertId);
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', expertId);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: `Failed to delete: ${err.message}`, variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    available: 'bg-green-100 text-green-700',
    busy: 'bg-yellow-100 text-yellow-700',
    unavailable: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t('admin.experts.title')}</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage expert profiles.{' '}
            <span className="font-medium text-gray-700">{experts.length} experts total</span>
            {tenantId && <> · <span className="font-medium text-amber-600">{boostIds.length} featured</span></>}
          </p>
        </div>
        <button
          onClick={() => setEditingExpert('new')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Expert
        </button>
      </div>

      <div className="bg-white rounded-[16px] border border-gray-200 shadow-sm overflow-hidden">
        {experts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
            <Users className="w-10 h-10 opacity-30" />
            <p className="text-sm">{t('admin.experts.noExperts')}</p>
            <button
              onClick={() => setEditingExpert('new')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Add your first expert →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {experts.map((expert) => {
              const isBoosted = boostIds.includes(expert.id);
              const isToggling = togglingId === expert.id;
              const isDeleting = deletingId === expert.id;
              return (
                <div
                  key={expert.id}
                  className={`flex items-center gap-4 px-5 py-4 transition-colors ${isBoosted ? 'bg-amber-50/50' : 'hover:bg-gray-50/50'}`}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden border-2 border-white shadow-sm">
                    {expert.profile_image_url ? (
                      <img src={expert.profile_image_url} alt={expert.first_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-semibold bg-indigo-50 text-indigo-500">
                        {expert.first_name?.[0] ?? 'E'}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{expert.first_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-gray-500 truncate">
                        {expert.expert_specialties?.[0] ?? t('admin.experts.generalExpert')}
                        {expert.expert_experience_years ? ` · ${expert.expert_experience_years} yrs` : ''}
                      </p>
                      {expert.expert_availability_status && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${statusColor[expert.expert_availability_status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {expert.expert_availability_status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Rating */}
                  {expert.expert_rating && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      {expert.expert_rating.toFixed(1)}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Feature toggle (only when a tenant is selected) */}
                    {tenantId && (
                      <button
                        onClick={() => handleToggleBoost(expert.id)}
                        disabled={isToggling}
                        title={isBoosted ? t('admin.experts.removeFromFeatured') : t('admin.experts.featureExpert')}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all disabled:opacity-50 ${
                          isBoosted
                            ? 'bg-amber-50 border-amber-300 text-amber-700 hover:border-red-300 hover:text-red-500 hover:bg-red-50'
                            : 'border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50'
                        }`}
                      >
                        {isToggling ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Star className={`w-3.5 h-3.5 ${isBoosted ? 'fill-amber-400' : ''}`} />
                        )}
                      </button>
                    )}

                    {/* Edit */}
                    <button
                      onClick={() => setEditingExpert(expert.id)}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all"
                      title="Edit expert"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(expert.id)}
                      disabled={isDeleting}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
                      title="Delete expert"
                    >
                      {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Expert Form Modal */}
      {editingExpert && (
        <AdminExpertForm
          expertId={editingExpert}
          onClose={() => setEditingExpert(null)}
          onSaved={() => fetchData()}
        />
      )}
    </div>
  );
};

export default ExpertCurationPanel;
