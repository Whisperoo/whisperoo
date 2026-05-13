import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { usePersonalizedExpertSort, ExpertForSort } from '@/hooks/usePersonalizedExpertSort';
import { getLocalizedBio } from '@/services/translationService';

interface ExpertRow extends ExpertForSort {
  first_name: string;
  expert_bio: string | null;
  expert_bio_es?: string | null;
  expert_bio_vi?: string | null;
  expert_experience_years: number | null;
  profile_image_url: string | null;
  tenant_id: string | null;
}

const TOP_N = 3;

export const RecommendedExperts: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { sortPersonalized } = usePersonalizedExpertSort();
  const { isHospitalUser, tenant, config } = useTenant();

  const [experts, setExperts] = useState<ExpertRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select(
            'id, first_name, expert_bio, expert_bio_es, expert_bio_vi, expert_specialties, expert_experience_years, profile_image_url, expert_rating, expert_total_reviews, expert_verified, tenant_id',
          )
          .eq('account_type', 'expert')
          .eq('expert_verified', true)
          .neq('expert_availability_status', 'unavailable')
          .not('expert_profile_visibility', 'eq', false)
          .not('expert_accepts_new_clients', 'eq', false);

        if (error) throw error;
        if (cancelled) return;

        let list = (data ?? []) as ExpertRow[];

        const disabled = config?.disabled_expert_ids ?? [];
        if (disabled.length > 0) {
          list = list.filter((e) => !disabled.includes(e.id));
        }
        if (isHospitalUser && tenant?.id) {
          list = list.filter((e) => !e.tenant_id || e.tenant_id === tenant.id);
        }

        setExperts(list);
      } catch (err) {
        console.error('Failed to load recommended experts', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isHospitalUser, tenant?.id, config?.disabled_expert_ids]);

  const sorted = sortPersonalized(experts).slice(0, TOP_N);

  if (loading) {
    return (
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          <h2 className="text-xl font-bold text-gray-900">{t('dashboard.recommendedExperts.title', 'Recommended Experts')}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (sorted.length === 0) return null;

  return (
    <div className="mb-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          <h2 className="text-xl font-bold text-gray-900">{t('dashboard.recommendedExperts.title', 'Recommended Experts')}</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
          onClick={() => navigate('/experts')}
        >
          {t('dashboard.recommendedExperts.viewAll', 'View All')} <ArrowRight className="ml-1 w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((expert) => (
          <Card
            key={expert.id}
            className="cursor-pointer hover:shadow-lg transition-shadow duration-200 bg-white border-none overflow-hidden"
            onClick={() => navigate(`/experts/${expert.id}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  {expert.profile_image_url ? (
                    <img
                      src={expert.profile_image_url}
                      alt={expert.first_name}
                      className="w-14 h-14 rounded-full object-cover shadow-sm"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        (e.currentTarget.nextElementSibling as HTMLElement)?.style.setProperty('display', 'flex');
                      }}
                    />
                  ) : null}
                  <div
                    className="w-14 h-14 rounded-full flex-shrink-0 bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg"
                    style={{ display: expert.profile_image_url ? 'none' : 'flex' }}
                  >
                    {expert.first_name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-base text-gray-900 leading-tight mb-0.5 break-words">
                    {expert.first_name}
                  </h3>
                  <p className="text-indigo-600 font-semibold text-xs mb-1 break-words">
                    {expert.expert_specialties?.[0] || t('experts.generalExpert', 'General Expert')}
                  </p>
                  <p className="text-gray-600 text-xs leading-relaxed line-clamp-2 break-words">
                    {getLocalizedBio(expert as any, i18n.language)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default RecommendedExperts;
