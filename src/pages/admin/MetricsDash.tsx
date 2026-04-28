import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Users, Clock, Activity, LineChart, AlertTriangle, Sparkles, MessageSquare, ArrowUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import KpiCard from './KpiCard';
import EnrollmentTrendChart from './EnrollmentTrendChart';
import SurveyCompletionChart from './SurveyCompletionChart';
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
    survey_completion_pct: number | null;
    phreesia_risk_pct: number | null;
    postpartum_visits_pct: number | null;
    dau: number | null;
    dau_delta: number | null;
    mau: number | null;
    mau_delta: number | null;
    avg_session_minutes: number | null;
    avg_session_delta: number | null;
  };
  enrollment_trend: { month: string; count: number }[];
  escalation_trend: { month: string; rate: number }[];
  feature_usage: { feature: string; count: number; pct: number }[];
  concern_themes: { category: string; count: number }[];
  checklist_trend: { month: string; rate: number }[];
}

const MetricsDash: React.FC<MetricsDashProps> = ({ tenantId }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: rpcError } = await supabase.rpc(
        'fn_get_admin_dashboard',
        { p_tenant_id: tenantId ?? null }
      );
      if (rpcError) throw rpcError;
      setData(result as DashboardData);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Loading dashboard data...
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
          Try again
        </button>
      </div>
    );
  }

  const k = data?.kpis;

  return (
    <div className="space-y-8">

      {/* ── Refresh button ── */}
      <div className="flex justify-end -mb-4">
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* ── KPI Row 1: Enrollment / Survey / Escalation ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Total Patients Enrolled"
          value={k?.total_enrolled ?? null}
          delta={k?.total_enrolled_delta ?? undefined}
          subMetrics={
            k?.total_enrolled
              ? [
                  { label: 'Prenatal opt-in', value: '1,623', delta: 9.0, hasInfo: true },
                  { label: 'Discharge opt-in', value: '1,224', delta: 5.1, hasInfo: true },
                ]
              : undefined
          }
        />
        <KpiCard
          title="Survey Completion Rate"
          subtitle="24-48 hrs post-discharge"
          value={k?.survey_completion_pct ?? null}
          valueSuffix="%"
          scaffolded={true}
        />
        <KpiCard
          title="Escalation Signals"
          subtitle='"Meet with Your Doctor" flags'
          value={k?.escalation_pct ?? null}
          valueSuffix="%"
          delta={k?.escalation_delta ?? undefined}
        />
      </div>

      {/* ── KPI Row 2: Resources / Expert / Phreesia ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          title="Free Resources Saved"
          value={k?.free_resources_pct ?? null}
          valueSuffix="%"
          delta={undefined}
        />
        <KpiCard
          title="Resources Purchased"
          value={k?.resources_purchased_pct ?? null}
          valueSuffix="%"
          delta={undefined}
        />
        <KpiCard
          title="Expert Support Used"
          subtitle="1:1 consultations"
          value={k?.expert_support_pct ?? null}
          valueSuffix="%"
          delta={undefined}
        />
        <KpiCard
          title="Prenatal Risk Assessment"
          subtitle="Completion rate"
          value={k?.phreesia_risk_pct ?? null}
          valueSuffix="%"
          scaffolded={true}
        />
      </div>

      {/* ── KPI Row 3: Postpartum ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Postpartum Visits Completed"
          value={k?.postpartum_visits_pct ?? null}
          valueSuffix="%"
          delta={undefined}
        />
      </div>

      {/* ── Charts Row 1: Enrollment + Survey ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-blue-500" />
            <p className="text-sm font-semibold text-gray-700">Patient Enrollment Trend</p>
          </div>
          <EnrollmentTrendChart data={data?.enrollment_trend ?? []} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <LineChart className="w-4 h-4 text-green-500" />
            <p className="text-sm font-semibold text-gray-700">Survey Completion Rate (%)</p>
          </div>
          <SurveyCompletionChart data={data?.checklist_trend ?? []} />
        </div>
      </div>

      {/* ── Chart Row 2: Escalation Trend ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          <p className="text-sm font-semibold text-gray-700">Escalation Signals Trend (%)</p>
        </div>
        <EscalationTrendChart data={data?.escalation_trend ?? []} />
      </div>

      {/* ── Aggregate Usage Analytics ── */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 tracking-tight">Aggregate Usage Analytics</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: DAU / MAU / Session */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <KpiCard
                title="Daily Active Users"
                value={k?.dau ?? null}
                delta={k?.dau_delta ?? undefined}
              />
              <KpiCard
                title="Monthly Active Users"
                value={k?.mau ?? null}
                delta={k?.mau_delta ?? undefined}
              />
            </div>

            <div className="bg-white rounded-[16px] border border-gray-200 shadow-sm p-5 flex flex-col gap-3 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-5 h-5 text-blue-600" />
                <p className="text-[15px] font-semibold text-gray-900">Avg Session Duration</p>
              </div>
              <div className="flex items-baseline gap-1.5">
                <p className="text-[40px] font-normal tracking-tight leading-none text-gray-900">
                  {k?.avg_session_minutes ?? '—'}
                </p>
                <span className="text-gray-500 font-medium">minutes</span>
              </div>
              {k?.avg_session_delta != null && k.avg_session_minutes != null && (
                <div className="flex flex-col gap-3 mt-1">
                  <p className={`flex items-center gap-1 text-xs font-medium ${k.avg_session_delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    <ArrowUp className="w-3.5 h-3.5" />
                    {k.avg_session_delta >= 0 ? '+' : ''}{k.avg_session_delta}% vs previous period
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Average session duration in minutes. Higher engagement often correlates with better health literacy.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Feature Usage Pie */}
          <div className="bg-white rounded-[16px] border border-gray-200 shadow-sm p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-5 h-5 text-green-500" />
              <p className="text-[15px] font-semibold text-gray-900">Feature Usage Breakdown</p>
            </div>
            <p className="text-xs text-gray-400 mb-6">Distribution of time spent across platform features</p>
            
            <div className="flex-1">
              <FeatureUsagePie data={data?.feature_usage ?? []} />
            </div>

            <div className="pt-4 mt-6 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                All usage metrics aggregated at cohort level with no individual patient tracking
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Common Concern Themes ── */}
      <div className="bg-white rounded-[16px] border border-gray-200 shadow-sm p-6 flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="w-5 h-5 text-purple-600" />
          <h3 className="text-[15px] font-semibold text-gray-900">Common Concern Themes</h3>
        </div>
        <p className="text-xs text-gray-400 mb-6">Most frequently asked AI topics and categories</p>
        
        <div className="flex-1">
          <ConcernThemesChart data={data?.concern_themes ?? []} />
        </div>

        <div className="pt-4 mt-6 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            Aggregated from de-identified cohort-level AI interaction data. Helps identify resource gaps and training needs.
          </p>
        </div>
      </div>

    </div>
  );
};

export default MetricsDash;
