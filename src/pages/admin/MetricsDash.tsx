import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Users, Clock, Activity, AlertTriangle, Sparkles, MessageSquare, ArrowUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import KpiCard from './KpiCard';
import EnrollmentTrendChart from './EnrollmentTrendChart';
import EscalationTrendChart from './EscalationTrendChart';
import FeatureUsagePie from './FeatureUsagePie';
import ConcernThemesChart from './ConcernThemesChart';

interface MetricsDashProps {
  tenantId: string | null;
}

interface DashboardData {
  kpis: {
    total_enrolled: number | null;
    total_enrolled_delta: number | null;
    escalation_pct: number | null;
    escalation_delta: number | null;
    free_resources_pct: number | null;
    resources_purchased_pct: number | null;
    expert_support_pct: number | null;
    dau: number | null;
    dau_delta: number | null;
    mau: number | null;
    mau_delta: number | null;
    avg_session_minutes: number | null;
    avg_session_delta: number | null;
    lactation_appointments: number | null;
    lactation_engagement: number | null;
    hospital_resource_eng: number | null;
    checklist_engagement: number | null;
    appointment_checklist_engagement_pct?: number | null;
  };
  enrollment_trend: { month: string; count: number }[];
  escalation_trend: { month: string; rate: number }[];
  feature_usage: { feature: string; count: number; pct: number }[];
  concern_themes: { category: string; count: number }[];
  checklist_trend: { month: string; rate: number }[];
  resource_utilization?: {
    product_id: string;
    title: string;
    total_views: number;
    total_downloads: number;
    total_saves: number;
    total_revenue: number;
  }[];
  qr_metrics?: {
    totals: { scans: number; signups: number };
    by_qr: Array<{
      qr_code_id: string;
      token: string;
      label: string | null;
      department: string | null;
      tenant_id: string;
      scans: number;
      signups: number;
    }>;
  };
}

const MetricsDash: React.FC<MetricsDashProps> = ({ tenantId }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Initialize to last 30 days by default
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const { t } = useTranslation();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: rpcError } = await supabase.rpc(
        'fn_get_admin_dashboard',
        { 
          p_tenant_id: tenantId ?? null,
          p_start_date: startDate || null,
          p_end_date: endDate || null
        }
      );
      if (rpcError) throw rpcError;

      // Appointment booking engagement (%): based on consultation_bookings
      const { data: apptPct, error: apptErr } = await supabase.rpc(
        'fn_get_appointment_booking_engagement_pct',
        {
          p_tenant_id: tenantId ?? null,
          p_start_date: startDate || null,
          p_end_date: endDate || null,
        }
      );
      // Fail-soft: if KPI function isn't deployed yet, don't break the whole dashboard.
      if (apptErr) {
        console.warn('Appointment KPI unavailable:', apptErr);
      }
      
      const { data: resourceData, error: resourceError } = await supabase.rpc(
        'fn_get_resource_utilization',
        { 
          p_tenant_id: tenantId ?? null,
          p_start_date: startDate || null,
          p_end_date: endDate || null
        }
      );
      if (resourceError) throw resourceError;

      // QR attribution metrics (fail-soft if not deployed yet)
      const { data: qrData, error: qrErr } = await supabase.rpc(
        'fn_admin_qr_signup_metrics',
        {
          p_tenant_id: tenantId ?? null,
          p_start_date: startDate || null,
          p_end_date: endDate || null,
        }
      );
      const qrAccessDenied =
        (qrErr as any)?.code === 'P0001' &&
        typeof (qrErr as any)?.message === 'string' &&
        (qrErr as any).message.toLowerCase().includes('access denied');
      if (qrErr && !qrAccessDenied) {
        console.warn('QR metrics unavailable:', qrErr);
      }
      
      setData({
        ...(result as DashboardData),
        kpis: {
          ...((result as DashboardData).kpis ?? {}),
          appointment_checklist_engagement_pct: apptErr ? null : (apptPct as number | null) ?? null,
        },
        resource_utilization: resourceData || [],
        qr_metrics: qrErr ? undefined : (qrData as any),
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [tenantId, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        {t('admin.metrics.loadingDashboard')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-red-500 text-sm font-medium">{error}</p>
        <button
          onClick={fetchData}
          className="text-xs text-gray-500 underline hover:text-gray-700"
        >
          {t('admin.metrics.tryAgain')}
        </button>
      </div>
    );
  }

  const k = data?.kpis;

  return (
    <div className="space-y-8">

      {/* ── Header Controls ── */}
      <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4 -mb-4">
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-1">Start Date</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-1">End Date</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          {/* <button 
            onClick={fetchData}
            className="mt-5 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
          >
            Apply
          </button> */}
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t('admin.metrics.refresh')}
        </button>
      </div>

      {/* ── KPI Row 1: Enrollment / Survey / Escalation ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title={t('admin.metrics.totalEnrolled')}
          value={k?.total_enrolled ?? null}
          delta={k?.total_enrolled_delta ?? undefined}
          tooltip={t('admin.metrics.tooltips.totalEnrolled')}
        />
        <KpiCard
          title="Appointment Booking Rate"
          subtitle="Consultation Bookings"
          value={k?.appointment_checklist_engagement_pct ?? null}
          valueSuffix="%"
          tooltip="Percent of enrolled users who booked at least one consultation appointment in the selected date range."
        />
        <KpiCard
          title={t('admin.metrics.escalationSignals')}
          subtitle={t('admin.metrics.escalationSubtitle')}
          value={k?.escalation_pct ?? null}
          valueSuffix="%"
          delta={k?.escalation_delta ?? undefined}
          tooltip={t('admin.metrics.tooltips.escalation')}
        />
      </div>

      {/* ── KPI Row 2: Resources / Expert ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title={t('admin.metrics.freeResourcesSaved')}
          value={k?.free_resources_pct ?? null}
          valueSuffix="%"
          delta={undefined}
          tooltip={t('admin.metrics.tooltips.freeResources')}
        />
        <KpiCard
          title={t('admin.metrics.resourcesPurchased')}
          value={k?.resources_purchased_pct ?? null}
          valueSuffix="%"
          delta={undefined}
          tooltip={t('admin.metrics.tooltips.resourcesPurchased')}
        />
        <KpiCard
          title={t('admin.metrics.expertSupport')}
          subtitle={t('admin.metrics.expertSupportSubtitle')}
          value={k?.expert_support_pct ?? null}
          valueSuffix="%"
          delta={undefined}
          tooltip={t('admin.metrics.tooltips.expertSupport')}
        />
      </div>

      {/* ── KPI Row 3: Postpartum & Engagement ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Lactation Support"
          subtitle="Consults & Resources"
          value={k?.lactation_engagement ?? null}
          valueSuffix=""
          delta={undefined}
          tooltip="Engagement with Lactation resources and consultations"
        />
        <KpiCard
          title="Education Engagement"
          subtitle="Hospital Resources"
          value={k?.hospital_resource_eng ?? null}
          valueSuffix=""
          delta={undefined}
          tooltip="Views, saves, and downloads of designated hospital resources"
        />
        <KpiCard
          title="Checklist Completion"
          subtitle="Total Completed"
          value={k?.checklist_engagement ?? null}
          valueSuffix=""
          delta={undefined}
          tooltip="Total number of checklist items completed by users"
        />
      </div>

      {/* ── Chart Row 1: Enrollment ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-blue-500" />
          <p className="text-sm font-semibold text-gray-700">{t('admin.metrics.enrollmentTrend')}</p>
        </div>
        <EnrollmentTrendChart data={data?.enrollment_trend ?? []} />
      </div>

      {/* ── Chart Row 2: Escalation Trend ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          <p className="text-sm font-semibold text-gray-700">{t('admin.metrics.escalationTrend')}</p>
        </div>
        <EscalationTrendChart data={data?.escalation_trend ?? []} />
      </div>

      {/* ── Aggregate Usage Analytics ── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 tracking-tight">{t('admin.metrics.aggregateUsage')}</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: DAU / MAU / Session */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <KpiCard
                title={t('admin.metrics.dau')}
                value={k?.dau ?? null}
                delta={k?.dau_delta ?? undefined}
                tooltip={t('admin.metrics.tooltips.dau')}
              />
              <KpiCard
                title={t('admin.metrics.mau')}
                value={k?.mau ?? null}
                delta={k?.mau_delta ?? undefined}
                tooltip={t('admin.metrics.tooltips.mau')}
              />
            </div>

            <div className="bg-white rounded-[16px] border border-gray-200 shadow-sm p-5 flex flex-col gap-3 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-5 h-5 text-blue-600" />
                <p className="text-[15px] font-semibold text-gray-900">{t('admin.metrics.avgSession')}</p>
              </div>
              <div className="flex items-baseline gap-1.5">
                <p className="text-[40px] font-normal tracking-tight leading-none text-gray-900">
                  {k?.avg_session_minutes ?? '—'}
                </p>
                <span className="text-gray-500 font-medium">{t('admin.metrics.minutes')}</span>
              </div>
              {k?.avg_session_delta != null && k.avg_session_minutes != null && (
                <div className="flex flex-col gap-3 mt-1">
                  <p className={`flex items-center gap-1 text-xs font-medium ${k.avg_session_delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    <ArrowUp className="w-3.5 h-3.5" />
                    {k.avg_session_delta >= 0 ? '+' : ''}{k.avg_session_delta}% {t('admin.metrics.vsPrevious')}
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {t('admin.metrics.sessionEngagement')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Feature Usage Pie */}
          <div className="bg-white rounded-[16px] border border-gray-200 shadow-sm p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-5 h-5 text-green-500" />
              <p className="text-[15px] font-semibold text-gray-900">{t('admin.metrics.featureUsage')}</p>
            </div>
            <p className="text-xs text-gray-400 mb-6">{t('admin.metrics.featureUsageSubtitle')}</p>
            
            <div className="flex-1">
              <FeatureUsagePie data={data?.feature_usage ?? []} />
            </div>

            <div className="pt-4 mt-6 border-t border-gray-100">
              <p className="text-xs text-gray-400">
              {t('admin.metrics.featureUsageDisclaimer')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Common Concern Themes ── */}
      <div className="bg-white rounded-[16px] border border-gray-200 shadow-sm p-6 flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="w-5 h-5 text-purple-600" />
          <h3 className="text-[15px] font-semibold text-gray-900">{t('admin.metrics.concernThemes')}</h3>
        </div>
        <p className="text-xs text-gray-400 mb-6">{t('admin.metrics.concernThemesSubtitle')}</p>
        
        <div className="flex-1">
          <ConcernThemesChart data={data?.concern_themes ?? []} />
        </div>

        <div className="pt-4 mt-6 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            {t('admin.metrics.concernThemesDisclaimer')}
          </p>
        </div>
      </div>

    {/* ── Resource Utilization Table ── */}
      <div className="bg-white rounded-[16px] border border-gray-200 shadow-sm p-6 flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-5 h-5 text-indigo-600" />
          <h3 className="text-[15px] font-semibold text-gray-900">Resource Utilization</h3>
        </div>
        <p className="text-xs text-gray-400 mb-6">Detailed engagement and revenue metrics per product.</p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-y border-gray-200">
              <tr>
                <th className="px-4 py-3">Resource Title</th>
                <th className="px-4 py-3 text-right">Views</th>
                <th className="px-4 py-3 text-right">Downloads</th>
                <th className="px-4 py-3 text-right">Saves</th>
                <th className="px-4 py-3 text-right">Revenue Generated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data?.resource_utilization?.length ?? 0) > 0 ? (
                data!.resource_utilization!.map((row) => (
                  <tr key={row.product_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.title}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.total_views.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.total_downloads.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.total_saves.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-600">${row.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No resource utilization data found for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── QR Signup Attribution ── */}
      {data?.qr_metrics && (
        <div className="bg-white rounded-[16px] border border-gray-200 shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[15px] font-semibold text-gray-900">QR Signup Attribution</h3>
              <p className="text-xs text-gray-400">
                Scans and completed signups attributed to immutable hospital QR tokens.
              </p>
            </div>
            <div className="text-xs text-gray-500">
              <span className="font-semibold text-gray-800">{data.qr_metrics.totals?.scans ?? 0}</span> scans ·{' '}
              <span className="font-semibold text-gray-800">{data.qr_metrics.totals?.signups ?? 0}</span> signups
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 font-medium border-y border-gray-200">
                <tr>
                  <th className="px-4 py-3">Label</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3 text-right">Scans</th>
                  <th className="px-4 py-3 text-right">Signups</th>
                  <th className="px-4 py-3 text-right">Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data.qr_metrics.by_qr?.length ?? 0) > 0 ? (
                  data.qr_metrics.by_qr.map((row) => {
                    const scans = row.scans || 0;
                    const signups = row.signups || 0;
                    const conv = scans > 0 ? Math.round((signups / scans) * 1000) / 10 : 0;
                    return (
                      <tr key={row.qr_code_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {row.label || row.token}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {row.department || '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{scans.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{signups.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-medium text-indigo-700">{conv}%</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No QR activity found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default MetricsDash;
