import React from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useNavigate } from "react-router-dom";
import { ArrowRight, MessageCircle, Phone, Building2, Mail, Calendar } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
// import AIMomCallModule from "@/components/dashboard/AIMomCallModule"; // Hidden for now
import PostDeliveryPrompt from "@/components/dashboard/PostDeliveryPrompt";
import AppointmentReminders from "@/components/dashboard/AppointmentReminders";
import RecommendedProducts from "@/components/dashboard/RecommendedProducts";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { profile, user } = useAuth();
  const { isHospitalUser, tenant, config } = useTenant();
  const navigate = useNavigate();
  const firstName = profile?.first_name || "there";
  const isMobile = useIsMobile();
  
  const [expectingKids, setExpectingKids] = useState<any[]>([]);
  const [consultationAppointments, setConsultationAppointments] = useState<any[]>([]);

  const fetchKids = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('kids')
      .select('*')
      .eq('parent_id', user.id)
      .eq('is_expecting', true);
    if (data) setExpectingKids(data);
  };

  useEffect(() => {
    fetchKids();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile?.expecting_status]);

  // Check whether user has any consultation appointments
  useEffect(() => {
    const checkConsultationAppointments = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('consultation_bookings')
          .select('id, status, appointment_name, expert_name, booked_at')
          .eq('user_id', user.id)
          .in('status', ['pending', 'confirmed'])
          .order('booked_at', { ascending: false })
          .limit(3);
        if (error) throw error;
        const appointments = data || [];
        setConsultationAppointments(appointments);
      } catch (err) {
        console.error('Error checking consultation appointments:', err);
        setConsultationAppointments([]);
      }
    };
    checkConsultationAppointments();
  }, [user]);

  return (
    <main
      className={`w-full max-w-full overflow-x-hidden box-border ${isMobile ? "px-3 sm:px-4 py-4 sm:py-6" : "max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8"}`}
    >
      {/* Welcome Section */}
      <div className="mb-6 overflow-hidden">
        <h1 className="text-2xl font-bold text-brand-primary mb-2 break-words">
          {t('dashboard.welcome.greeting', { firstName })}
        </h1>
        <p className="text-gray-600 break-words">
          {t('dashboard.welcome.subtitle')}
        </p>
      </div>




      {/* 24/7 Support Card - Featured (Start Chat Genie) */}
      <div
        onClick={() => navigate("/chat")}
        className="bg-white rounded-xl shadow-card p-6 mb-6 border border-gray-200 cursor-pointer hover:shadow-elevated transition-all duration-200 hover:border-brand-primary"
      >
        <div className="flex items-center justify-between mb-4 w-full">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="flex items-center space-x-2 flex-shrink-0">
              <MessageCircle className="w-5 h-5 text-brand-primary" />
            </div>
            <h2 className="text-lg font-semibold text-brand-primary truncate">
              {t('dashboard.chatCard.title')}
            </h2>
          </div>
          <ArrowRight className="w-5 h-5 text-brand-primary flex-shrink-0 ml-2" />
        </div>
        <p className="text-gray-600 leading-relaxed">
          {t('dashboard.chatCard.description')}
        </p>
      </div>

      <RecommendedProducts />


      {/* Post-Delivery Prompt (Has your baby arrived?) */}
      {expectingKids.length > 0 && (
        <div className="w-full max-w-full overflow-hidden box-border mt-6">
          <PostDeliveryPrompt 
            expectingKids={expectingKids} 
            onBirthRecorded={fetchKids} 
          />
        </div>
      )}

      {/* Important Appointments */}
      <div className="w-full max-w-full overflow-hidden box-border mt-6">
        <AppointmentReminders />
      </div>

      {consultationAppointments.length > 0 && (
        <div className="bg-white rounded-xl shadow-card border border-blue-100 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-blue-50 flex items-center gap-3 bg-blue-50/40">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Your 1:1 Bookings</h2>
              <p className="text-sm text-gray-500">Recent consultation requests and confirmations</p>
            </div>
          </div>

          <div className="p-3 space-y-2">
            {consultationAppointments.map((booking) => (
              <div
                key={booking.id}
                className="rounded-lg border border-gray-100 p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {booking.appointment_name || "Consultation"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {booking.expert_name ? `with ${booking.expert_name}` : "Expert consultation"}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border ${
                    booking.status === 'confirmed'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {booking.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Explore Card */}
      <div
        className="bg-white rounded-xl shadow-card p-6 border border-gray-200 cursor-pointer hover:shadow-elevated transition-all duration-200 hover:border-brand-primary"
        onClick={() => navigate("/experts")}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-brand-primary">
            {t('dashboard.exploreCard.title')}
          </h2>
          <ArrowRight className="w-5 h-5 text-brand-primary" />
        </div>
        <p className="text-gray-600 leading-relaxed">
          {t('dashboard.exploreCard.description')}
        </p>
      </div>

      {/* Contact / Concierge Card */}
      <div className="bg-white rounded-xl shadow-card p-6 mt-6 border border-gray-200">
        <div className="flex items-start space-x-4 mb-5">
          <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-6 h-6 text-brand-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 mb-1">{t('dashboard.contactCard.title')}</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              {t('dashboard.contactCard.description')}
            </p>
          </div>
        </div>
        <a
          href={`mailto:${(config as any)?.branding?.contact_email || 'support@whisperoo.app'}?subject=Support%20Request`}
          className="flex items-center justify-center w-full bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-sm mb-3"
        >
          {t('dashboard.contactCard.button')}
        </a>
        <p className="text-center text-sm text-gray-500">
          {t('dashboard.contactCard.orEmail')} {" "}
          <a
            href={`mailto:${(config as any)?.branding?.contact_email || 'support@whisperoo.app'}`}
            className="font-semibold text-brand-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            {(config as any)?.branding?.contact_email || 'support@whisperoo.app'}
          </a>
        </p>
      </div>
    </main>
  );
};
export default Dashboard;
