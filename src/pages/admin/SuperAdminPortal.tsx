import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Activity, CalendarDays, BarChart3, MessageSquare, PackageSearch, Users, Settings2, LogOut } from 'lucide-react';
import HospitalSelector from './HospitalSelector';
import MetricsDash from './MetricsDash';
import AIInteractionsPanel from './AIInteractionsPanel';
import TenantConfigEditor from './TenantConfigEditor';
import ContentCurationPanel from './ContentCurationPanel';
import ExpertCurationPanel from './ExpertCurationPanel';

// ─── Super Admin Access Control ───────────────────────────────────
const SUPER_ADMIN_EMAILS = [
  'engineering@whisperoo.app',
  'sharab.khan101010@gmail.com'
];

type Tab = 'metrics' | 'ai' | 'content' | 'experts' | 'config';

const SuperAdminPortal: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [authorized, setAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Shell State
  const [activeTab, setActiveTab] = useState<Tab>('metrics');
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    const isAuthorized = 
      SUPER_ADMIN_EMAILS.includes(user.email || '') || 
      profile?.account_type === 'admin' || 
      profile?.account_type === 'super_admin';

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
  }, [user, profile, navigate]);

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
                  navigate('/');
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-6">
            
            {/* Left: Hospital Selector */}
            <div className="w-full sm:w-auto">
              <HospitalSelector
                selectedTenantId={selectedTenantId}
                onTenantChange={setSelectedTenantId}
              />
            </div>

            {/* Right: Tabs */}
            <div className="flex flex-wrap items-center gap-1 bg-gray-50 p-1.5 rounded-xl">
              {([
                { id: 'metrics',  icon: BarChart3,      label: t('admin.portal.tabs.metrics')  },
                { id: 'ai',       icon: MessageSquare,  label: t('admin.portal.tabs.aiLogs')  },
                { id: 'content',  icon: PackageSearch,  label: t('admin.portal.tabs.content')  },
                { id: 'experts',  icon: Users,          label: t('admin.portal.tabs.experts')  },
                { id: 'config',   icon: Settings2,      label: t('admin.portal.tabs.config')   },
              ] as { id: Tab; icon: React.ElementType; label: string }[]).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
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
      </header>

      {/* ── Main Content Area ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'metrics'  && <MetricsDash tenantId={selectedTenantId} />}
        {activeTab === 'ai'       && <AIInteractionsPanel tenantId={selectedTenantId} />}
        {activeTab === 'content'  && <ContentCurationPanel tenantId={selectedTenantId} />}
        {activeTab === 'experts'  && <ExpertCurationPanel tenantId={selectedTenantId} />}
        {activeTab === 'config'   && <TenantConfigEditor tenantId={selectedTenantId} />}
      </main>
    </div>
  );
};

export default SuperAdminPortal;
