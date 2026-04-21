import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useNavigate } from "react-router-dom";
import { ArrowRight, MessageCircle, Phone, Building2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { UserResources } from "@/components/dashboard/UserResources";
import AIMomCallModule from "@/components/dashboard/AIMomCallModule";
import CareChecklist from "@/components/dashboard/CareChecklist";
import PostDeliveryPrompt from "@/components/dashboard/PostDeliveryPrompt";
import AppointmentReminders from "@/components/dashboard/AppointmentReminders";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const Dashboard: React.FC = () => {
  const { profile, user } = useAuth();
  const { isHospitalUser, tenant, config } = useTenant();
  const navigate = useNavigate();
  const firstName = profile?.first_name || "there";
  const isMobile = useIsMobile();
  
  const [expectingKids, setExpectingKids] = useState<any[]>([]);

  useEffect(() => {
    const fetchKids = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('kids')
        .select('*')
        .eq('parent_id', user.id)
        .eq('is_expecting', true);
      if (data) setExpectingKids(data);
    };
    fetchKids();
  }, [user, profile?.expecting_status]);

  return (
    <main
      className={`${isMobile ? "px-4 py-6" : "max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8"}`}
    >
      {/* Welcome Section */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-primary mb-2">
          Hi {firstName}!
        </h1>
        <p className="text-gray-600">
          Welcome to the club! Your go-to place for parenting answers, expert
          advice, and support.
        </p>
      </div>

      {/* Hospital Banner (Tenant Scope) — SOW 3.4 */}
      {isHospitalUser && config && tenant && (
        <div className="bg-brand-primary/5 rounded-xl p-5 mb-6 border border-brand-primary/20 flex flex-col sm:flex-row items-center sm:items-start gap-4 transition-all" style={{borderColor: config.branding?.primary_color}}>
          {config.branding?.logo_url ? (
            <img src={config.branding.logo_url} alt="Hospital Logo" className="w-16 h-16 object-contain bg-white rounded-md p-1 shadow-sm" />
          ) : (
             <div className="w-16 h-16 bg-white rounded-md p-1 shadow-sm flex items-center justify-center font-bold text-2xl text-brand-primary border border-gray-100">
               {tenant.name.charAt(0)}
             </div>
          )}
          <div className="text-center sm:text-left flex-1">
            <h2 className="text-lg font-bold text-brand-dark mb-1" style={{color: config.branding?.primary_color}}>
              {config.branding?.display_name || tenant.name}
            </h2>
            {/* Show user's department if captured */}
            {profile?.acquisition_department && (
              <p className="text-xs font-semibold text-indigo-600 mb-2">
                Your department: {(profile.acquisition_department as string).toUpperCase()}
              </p>
            )}
            <p className="text-sm text-gray-700 mb-3">
              We're here to support you on your parenting journey with exclusive resources tailored for your family.
            </p>
            {config.departments && config.departments.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                {config.departments.map((dept, idx) => {
                  // Highlight the user's own department
                  const isUserDept = profile?.acquisition_department && 
                    dept.name.toLowerCase().includes((profile.acquisition_department as string).toLowerCase());
                  return dept.phone ? (
                    <a key={idx} href={`tel:${dept.phone.replace(/[^0-9]/g, '')}`} className={`inline-flex items-center text-xs font-semibold px-2.5 py-1.5 border shadow-sm rounded-md hover:bg-gray-50 transition group ${
                      isUserDept 
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700' 
                        : 'bg-white border-gray-200 text-brand-dark'
                    }`}>
                      <Phone className="w-3 h-3 mr-1.5 text-gray-400 group-hover:text-brand-primary" />
                      {dept.name}: {dept.phone}
                    </a>
                  ) : (
                    <span key={idx} className="inline-flex items-center text-xs font-semibold px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-gray-600">
                      {dept.name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hospital Experts Quick Link — SOW 3.4 */}
      {isHospitalUser && tenant && (
        <div
          onClick={() => navigate("/experts")}
          className="bg-indigo-50 rounded-xl p-4 mb-6 border border-indigo-200 cursor-pointer hover:bg-indigo-100 hover:border-indigo-300 transition-all duration-200 flex items-center justify-between"
        >
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-indigo-900">
                Hospital Partner Experts
              </h3>
              <p className="text-xs text-indigo-600">
                View experts recommended by {config?.branding?.display_name || tenant.name}
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-indigo-500" />
        </div>
      )}

      {/* 24/7 Support Card - Featured */}
      <div
        onClick={() => navigate("/chat")}
        className="bg-white rounded-xl shadow-card p-6 mb-6 border border-gray-200 cursor-pointer hover:shadow-elevated transition-all duration-200 hover:border-brand-primary"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <img
                src="/stork-avatar.png"
                alt="Whisperoo"
                className="w-8 h-8 object-contain"
              />
              <MessageCircle className="w-5 h-5 text-brand-primary" />
            </div>
            <h2 className="text-lg font-semibold text-brand-primary">
              Start Chat Genie with Whisperoo
            </h2>
          </div>
          <ArrowRight className="w-5 h-5 text-brand-primary" />
        </div>
        <p className="text-gray-600 leading-relaxed">
          Genie remembers you and your family’s journey so answers are tailored,
          not generic. Get instant guidance, plus expert recommendations at any
          hour of the day.
        </p>
      </div>

      {/* Post-Delivery Prompt (Shows if pregnant) */}
      {expectingKids.length > 0 && (
        <div className="w-full max-w-full overflow-hidden box-border mb-6">
          <PostDeliveryPrompt 
            expectingKids={expectingKids} 
            onBirthRecorded={() => {
              // Trigger reload of kids context
              setExpectingKids([]);
            }} 
          />
        </div>
      )}

      {/* Appointment Reminders — Checklist style widgets */}
      <div className="w-full max-w-full overflow-hidden box-border">
        <AppointmentReminders />
      </div>

      {/* Care Checklist — SOW 4.1 */}
      <div className="w-full max-w-full overflow-hidden box-border mt-0">
        <CareChecklist />
      </div>

      {/* AI Mom Call Module - Wrap with overflow control */}
      <div className="w-full max-w-full overflow-hidden box-border">
        <AIMomCallModule />
      </div>

      {/* Dynamic User Resources - Wrap with overflow control */}
      <div className="w-full max-w-full overflow-hidden box-border mt-6">
        <UserResources />
      </div>

      {/* Explore Card */}
      <div
        className="bg-white rounded-xl shadow-card p-6 border border-gray-200 cursor-pointer hover:shadow-elevated transition-all duration-200 hover:border-brand-primary"
        onClick={() => navigate("/experts")}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-brand-primary">
            Explore Whisperoo Verified Experts
          </h2>
          <ArrowRight className="w-5 h-5 text-brand-primary" />
        </div>
        <p className="text-gray-600 leading-relaxed">
          Connect with board-certified professionals who specialize in child and
          family health
        </p>
      </div>
    </main>
  );
};
export default Dashboard;
