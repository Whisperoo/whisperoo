import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Booking {
  id: string;
  status: string;
  booked_at: string;
  appointment_name: string;
  expert_name: string;
}

export const RecentBookings: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    supabase
      .from('consultation_bookings')
      .select('id, status, booked_at, appointment_name, expert_name')
      .eq('user_id', user.id)
      .in('status', ['pending', 'confirmed'])
      .order('booked_at', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        setBookings(data ?? []);
        setLoading(false);
      });
  }, [user]);

  if (loading || bookings.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-card border border-blue-100 overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-blue-50 flex items-center justify-between bg-blue-50/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">{t('dashboard.bookings.title', { defaultValue: 'Your Bookings' })}</h2>
            <p className="text-sm text-gray-500">{t('dashboard.bookings.subtitle', { defaultValue: 'Active consultation appointments' })}</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/my-purchases?tab=appointments')}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          {t('dashboard.bookings.viewAll', { defaultValue: 'View all' })} <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-2 space-y-1">
        {bookings.map((booking) => (
          <div
            key={booking.id}
            className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={() => navigate('/my-purchases?tab=appointments')}
          >
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{booking.appointment_name}</p>
              <p className="text-xs text-gray-500">
                with {booking.expert_name} · {new Date(booking.booked_at).toLocaleDateString()}
              </p>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
              booking.status === 'confirmed'
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {booking.status === 'confirmed'
                ? t('dashboard.bookings.confirmed', { defaultValue: 'Confirmed' })
                : t('dashboard.bookings.pending', { defaultValue: 'Pending' })
              }
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentBookings;
