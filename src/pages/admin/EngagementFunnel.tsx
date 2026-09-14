import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import type { AdminSegment } from './HospitalSelector';

/**
 * Signup → engagement funnel. Answers the client's question: of the people who
 * signed up, what did they go on to do?
 *
 * Each bar is a percentage of SIGNED UP, not of the previous stage. The stages
 * are not a strict sequence — a parent can view content without ever opening a
 * chat — so a later bar can legitimately be taller than an earlier one. The
 * label under the chart says this so it is not misread as drop-off.
 */

interface FunnelStage {
  stage: string;
  stage_order: number;
  users: number;
}

interface Props {
  tenantId: string | null;
  segment: AdminSegment;
  startDate: string;
  endDate: string;
}

const EngagementFunnel: React.FC<Props> = ({ tenantId, segment, startDate, endDate }) => {
  const { t } = useTranslation();
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('fn_get_admin_funnel', {
        p_tenant_id: tenantId ?? null,
        p_segment: segment,
        p_start_date: startDate || null,
        p_end_date: endDate || null,
      });
      if (cancelled) return;
      if (error) {
        console.warn('Funnel unavailable:', error);
        setStages([]);
      } else {
        setStages(((data as FunnelStage[]) ?? []).sort((a, b) => a.stage_order - b.stage_order));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tenantId, segment, startDate, endDate]);

  const labels: Record<string, string> = {
    signed_up:           t('admin.funnel.signedUp', 'Signed up'),
    onboarded:           t('admin.funnel.onboarded', 'Finished onboarding'),
    started_chat:        t('admin.funnel.startedChat', 'Started a chat'),
    viewed_content:      t('admin.funnel.viewedContent', 'Viewed content'),
    saved_or_bought:     t('admin.funnel.savedOrBought', 'Saved or bought'),
    booked_consultation: t('admin.funnel.booked', 'Booked a consultation'),
  };

  const base = stages.find((s) => s.stage === 'signed_up')?.users ?? 0;

  return (
    <div className="bg-white rounded-[16px] border border-gray-200 shadow-sm p-6">
      <div className="mb-5">
        <h3 className="text-[15px] font-semibold text-gray-900">{t('admin.funnel.title', 'What signups go on to do')}</h3>
        <p className="text-xs text-gray-400">
          {t('admin.funnel.subtitle', 'Of everyone who signed up in this period. Each bar is a share of signups, not of the bar above — stages are not a strict sequence.')}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> {t('admin.metrics.loadingDashboard')}
        </div>
      ) : base === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">{t('admin.funnel.empty', 'No signups in this period.')}</p>
      ) : (
        <ol className="space-y-2.5">
          {stages.map((s) => {
            const pct = base > 0 ? Math.round((s.users / base) * 100) : 0;
            const isBase = s.stage === 'signed_up';
            return (
              <li key={s.stage} className="grid grid-cols-[11rem_1fr_5.5rem] items-center gap-3 text-sm">
                <span className={isBase ? 'font-semibold text-gray-900' : 'text-gray-700'}>{labels[s.stage] ?? s.stage}</span>
                <div className="h-6 bg-gray-100 rounded-md overflow-hidden">
                  <div
                    className={`h-full rounded-md transition-all ${isBase ? 'bg-gray-800' : 'bg-blue-500'}`}
                    style={{ width: `${Math.max(pct, s.users > 0 ? 2 : 0)}%` }}
                  />
                </div>
                <span className="text-right tabular-nums text-gray-700">
                  <span className="font-semibold">{s.users.toLocaleString()}</span>
                  <span className="text-gray-400 text-xs"> · {pct}%</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

export default EngagementFunnel;
