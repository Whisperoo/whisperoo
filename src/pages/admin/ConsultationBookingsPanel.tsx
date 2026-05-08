import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import {
  Search, Filter, CheckCircle2, XCircle, Clock,
  Mail, Loader2, CalendarDays, ChevronDown, RefreshCw
} from 'lucide-react';

interface ConsultationBooking {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  expert_id: string;
  expert_name: string;
  product_id: string;
  appointment_name: string;
  booking_type: 'direct' | 'inquiry';
  amount_paid: number | null;
  payment_status: 'unpaid' | 'paid' | 'free' | 'refunded';
  resource_type: 'whisperoo' | 'hospital';
  status: 'pending' | 'completed' | 'cancelled';
  booked_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
}

interface ConsultationBookingsPanelProps {
  tenantId: string | null;
}

type StatusFilter = 'all' | 'pending' | 'completed' | 'cancelled';
type ResourceFilter = 'all' | 'whisperoo' | 'hospital';

const ConsultationBookingsPanel: React.FC<ConsultationBookingsPanelProps> = ({ tenantId }) => {
  const [bookings, setBookings] = useState<ConsultationBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [resourceFilter, setResourceFilter] = useState<ResourceFilter>('all');
  const [expertFilter, setExpertFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('consultation_bookings')
        .select('*')
        .order('booked_at', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (err: any) {
      console.error('Error fetching bookings:', err);
      toast({ title: 'Error', description: 'Failed to load bookings', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookings(); }, []);

  // Unique expert names for filter dropdown
  const expertNames = useMemo(() => {
    const names = [...new Set(bookings.map(b => b.expert_name))].sort();
    return names;
  }, [bookings]);

  // Filtered bookings
  const filtered = useMemo(() => {
    return bookings.filter(b => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (resourceFilter !== 'all' && b.resource_type !== resourceFilter) return false;
      if (expertFilter !== 'all' && b.expert_name !== expertFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !b.user_name.toLowerCase().includes(q) &&
          !b.user_email.toLowerCase().includes(q) &&
          !b.appointment_name.toLowerCase().includes(q) &&
          !b.expert_name.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [bookings, statusFilter, resourceFilter, expertFilter, search]);

  // Stats
  const stats = useMemo(() => ({
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    completed: bookings.filter(b => b.status === 'completed').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
  }), [bookings]);

  const markComplete = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      const { error } = await supabase
        .from('consultation_bookings')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', bookingId);
      if (error) throw error;

      setBookings(prev => prev.map(b =>
        b.id === bookingId
          ? { ...b, status: 'completed' as const, completed_at: new Date().toISOString() }
          : b
      ));
      toast({ title: 'Marked Complete', description: 'Booking marked as Done.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const cancelBooking = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      const { error } = await supabase
        .from('consultation_bookings')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', bookingId);
      if (error) throw error;

      setBookings(prev => prev.map(b =>
        b.id === bookingId
          ? { ...b, status: 'cancelled' as const, cancelled_at: new Date().toISOString() }
          : b
      ));
      toast({ title: 'Cancelled', description: 'Booking has been cancelled.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  const formatAmount = (amount: number | null, bookingType: string) => {
    if (bookingType === 'inquiry' || amount === null || amount === 0) {
      return <span className="text-gray-400">—</span>;
    }
    return <span className="font-medium text-gray-900">${Number(amount).toFixed(2)}</span>;
  };

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Done
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
            <XCircle className="w-3 h-3" /> Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  const ResourceBadge = ({ type }: { type: string }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
      type === 'hospital'
        ? 'bg-blue-50 text-blue-700 border border-blue-200'
        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
    }`}>
      {type === 'hospital' ? '🏥' : '🔵'} {type === 'hospital' ? 'Hospital' : 'Whisperoo'}
    </span>
  );

  const PaymentStatusBadge = ({ status, amount }: { status: string; amount: number | null }) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
            💳 Paid {amount ? `$${Number(amount).toFixed(2)}` : ''}
          </span>
        );
      case 'free':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            🆓 Free
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
            ↩️ Refunded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200">
            ⏳ Unpaid
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
        {([
          { id: 'all' as StatusFilter, label: 'All Records', count: stats.total },
          { id: 'pending' as StatusFilter, label: 'Active', count: stats.pending },
          { id: 'completed' as StatusFilter, label: 'Completed', count: stats.completed },
          { id: 'cancelled' as StatusFilter, label: 'Cancelled', count: stats.cancelled },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex-1 justify-center ${
              statusFilter === tab.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              statusFilter === tab.id
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-200 text-gray-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Bookings', value: stats.total, color: 'text-gray-900', bg: 'bg-white' },
          { label: 'Pending', value: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Completed', value: stats.completed, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Cancelled', value: stats.cancelled, color: 'text-gray-500', bg: 'bg-gray-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl border border-gray-200 px-4 py-3`}>
            <p className="text-xs font-medium text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client name, email, or expert..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Resource Filter */}
        <div className="relative">
          <select
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value as ResourceFilter)}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">All Resources</option>
            <option value="whisperoo">🔵 Whisperoo</option>
            <option value="hospital">🏥 Hospital</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Expert Filter */}
        {expertNames.length > 0 && (
          <div className="relative">
            <select
              value={expertFilter}
              onChange={(e) => setExpertFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">All Experts</option>
              {expertNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        )}

        {/* Refresh */}
        <button
          onClick={fetchBookings}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-blue-600 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No bookings found</p>
          <p className="text-sm text-gray-400 mt-1">
            {search || statusFilter !== 'all' || resourceFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Bookings will appear here when patients book consultations'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Client</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Date Booked</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Expert</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Appointment</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Payment</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Resource</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((booking) => (
                  <tr
                    key={booking.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${
                      booking.status === 'cancelled' ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Client Name */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{booking.user_name}</p>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3">
                      <a
                        href={`mailto:${booking.user_email}`}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Mail className="w-3 h-3" />
                        {booking.user_email || '—'}
                      </a>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatDate(booking.booked_at)}
                    </td>

                    {/* Expert */}
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {booking.expert_name}
                    </td>

                    {/* Appointment Name */}
                    <td className="px-4 py-3 text-gray-700 max-w-[200px]">
                      <span className="line-clamp-2">{booking.appointment_name}</span>
                    </td>

                    {/* Payment Status */}
                    <td className="px-4 py-3">
                      <PaymentStatusBadge status={booking.payment_status} amount={booking.amount_paid} />
                    </td>

                    {/* Resource Type */}
                    <td className="px-4 py-3">
                      <ResourceBadge type={booking.resource_type} />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={booking.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      {booking.status === 'pending' ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => markComplete(booking.id)}
                            disabled={actionLoading === booking.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {actionLoading === booking.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3" />
                            )}
                            Done
                          </button>
                          <button
                            onClick={() => cancelBooking(booking.id)}
                            disabled={actionLoading === booking.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-3 h-3" />
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <span className="text-xs text-gray-400">
                            {booking.status === 'completed'
                              ? `Done ${booking.completed_at ? formatDate(booking.completed_at) : ''}`
                              : `Cancelled ${booking.cancelled_at ? formatDate(booking.cancelled_at) : ''}`}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Showing {filtered.length} of {bookings.length} bookings
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsultationBookingsPanel;
