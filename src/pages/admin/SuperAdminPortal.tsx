import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LANDING_URL } from '@/config/urls';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Activity, CalendarDays, BarChart3, MessageSquare, PackageSearch, Users, Settings2, LogOut, CalendarCheck, Shield, Tags, Info, LifeBuoy } from 'lucide-react';
import HospitalSelector, { type AdminSegment } from './HospitalSelector';
import MetricsDash from './MetricsDash';
import UsersPanel from './UsersPanel';
import SupportRequestsPanel from './SupportRequestsPanel';
import AIInteractionsPanel from './AIInteractionsPanel';
import TenantConfigEditor from './TenantConfigEditor';
import ContentCurationPanel from './ContentCurationPanel';
import ExpertCurationPanel from './ExpertCurationPanel';
import DiscountCodesPanel from './DiscountCodesPanel';
import ConsultationBookingsPanel from './ConsultationBookingsPanel';
import PhiAccessLogPanel from './PhiAccessLogPanel';
import ChatTopicCategoriesPanel from './ChatTopicCategoriesPanel';

/** Tabs whose data honours the audience segment. All others show a notice when a segment is active. */
const SEGMENT_AWARE_TABS: ReadonlySet<string> = new Set(['metrics', 'users', 'support']);

type Tab = 'metrics' | 'users' | 'support' | 'ai' | 'content' | 'experts' | 'bookings' | 'discounts' | 'phi' | 'topics' | 'config';

const SuperAdminPortal: React.FC = () => {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [authorized, setAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Shell State
  const [activeTab, setActiveTab] = useState<Tab>('metrics');
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  // Audience segment, chosen from the same control as the hospital. Only the
  // Metrics tab understands it today -- see the notice below.
  const [selectedSegment, setSelectedSegment] = useState<AdminSegment>('all');

  // Auth guard — wait for profile to load before making the authorization decision.
  // Checking before profile loads would redirect super_admins to /dashboard.
  useEffect(() => {
    if (!user) {
      navigate('/auth/login');
      return;
    }
    // Still loading initial auth or profile — stay on spinner
    if (loading) return;
    if (!profile) return;

    const isAuthorized =
      profile.account_type === 'admin' ||
      profile.account_type === 'super_admin';

    if (isAuthorized) {
      setAuthorized(true);
    } else {
      toast({
        title: t('admin.portal.accessDenied'),
        description: t('admin.portal.accessDeniedDesc'),
        variant: 'destructive',
      });
      navigate('/dashboard');
    }
    setCheckingAuth(false);
  }, [user, profile, loading, navigate]);

  if (checkingAuth || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto" />
          <p className="text-gray-600">{t('admin.portal.verifyingAccess')}</p>
        </div>
      </div>
    );
  }

  const currentDate = new Date().toLocaleDateString(i18n.language === 'es' ? 'es-ES' : i18n.language === 'vi' ? 'vi-VN' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Header ── */}
      <header className="bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-5 border-b border-gray-100">
            
            {/* Left: Branding */}
            <div className="flex items-center gap-3">
              <Activity className="w-7 h-7 text-blue-600 stroke-[2.5]" />
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">{t('admin.portal.title')}</h1>
            </div>

            {/* Right: Date & Actions */}
            <div className="flex items-center gap-4 text-sm font-medium">
              <div className="flex items-center gap-2 text-gray-500">
                <CalendarDays className="w-4 h-4 text-gray-400" />
                {currentDate}
              </div>
              <div className="h-4 w-px bg-gray-200 hidden sm:block" />
              <button
                onClick={() => {
                  signOut();
                  window.location.href = LANDING_URL;
                }}
                className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 transition-colors"
                title="Sign out of Admin Dashboard"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">{t('admin.portal.signOut')}</span>
              </button>
            </div>
          </div>

          {/* ── Sub-header / Toolbar ── */}
          <div className="flex flex-col gap-4 py-5">
            
            {/* Left: Hospital Selector */}
            <div className="w-full sm:w-64">
              <HospitalSelector
                selectedTenantId={selectedTenantId}
                selectedSegment={selectedSegment}
                onScopeChange={(tenantId, segment) => {
                  setSelectedTenantId(tenantId);
                  setSelectedSegment(segment);
                }}
              />
            </div>

            {/* Right: Tabs */}
            {/* Wrap rather than scroll: ten tabs never fit on one line at common
                widths, and a horizontally scrolling pill bar hides the tabs that
                matter most (the ones past the fold) behind a scrollbar. */}
            <div className="w-full">
              <div className="flex flex-wrap items-center gap-1 bg-gray-50 p-1.5 rounded-xl">
                {([
                  { id: 'metrics',  icon: BarChart3,      label: t('admin.portal.tabs.metrics')  },
                  { id: 'users',    icon: Users,          label: t('admin.portal.tabs.users', 'Users') },
                  { id: 'support',  icon: LifeBuoy,       label: t('admin.portal.tabs.support', 'Support Requests') },
                  { id: 'ai',       icon: MessageSquare,  label: t('admin.portal.tabs.aiLogs')  },
                  { id: 'content',  icon: PackageSearch,  label: t('admin.portal.tabs.content')  },
                  { id: 'experts',  icon: Users,          label: t('admin.portal.tabs.experts')  },
                  { id: 'bookings', icon: CalendarCheck,   label: 'Appointments' },
                  { id: 'discounts', icon: PackageSearch, label: 'Discounts' },
                  { id: 'phi',      icon: Shield,         label: 'PHI Access Log' },
                  { id: 'topics',   icon: Tags,           label: 'Chat Topics' },
                  { id: 'config',   icon: Settings2,      label: t('admin.portal.tabs.config')   },
                ] as { id: Tab; icon: React.ElementType; label: string }[]).map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-2 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      activeTab === id
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Every other tab still filters by hospital only. Rather than let a chosen
            segment appear to apply where it does not, say so plainly -- silently
            showing all users under a "Direct signups" scope is the same class of
            mismatch the segment filter was built to remove. */}
        {!SEGMENT_AWARE_TABS.has(activeTab) && selectedSegment !== 'all' && (
          <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            <p className="text-sm text-amber-900">
              {t('admin.scopeNotice.segmentNotApplied')}
            </p>
          </div>
        )}

        {activeTab === 'metrics'  && <MetricsDash tenantId={selectedTenantId} segment={selectedSegment} />}
        {activeTab === 'users'    && <UsersPanel tenantId={selectedTenantId} segment={selectedSegment} />}
        {activeTab === 'support'  && <SupportRequestsPanel tenantId={selectedTenantId} segment={selectedSegment} />}
        {activeTab === 'ai'       && <AIInteractionsPanel tenantId={selectedTenantId} />}
        {activeTab === 'content'  && <ContentCurationPanel tenantId={selectedTenantId} />}
        {activeTab === 'experts'  && <ExpertCurationPanel tenantId={selectedTenantId} />}
        {activeTab === 'bookings' && <ConsultationBookingsPanel tenantId={selectedTenantId} />}
        {activeTab === 'discounts' && <DiscountCodesPanel tenantId={selectedTenantId} />}
        {activeTab === 'phi'      && <PhiAccessLogPanel />}
        {activeTab === 'topics'   && <ChatTopicCategoriesPanel />}
        {activeTab === 'config'   && <TenantConfigEditor tenantId={selectedTenantId} />}
      </main>
    </div>
  );
};

export default SuperAdminPortal;
