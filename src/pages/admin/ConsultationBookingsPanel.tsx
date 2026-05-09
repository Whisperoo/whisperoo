import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import {
  Search, Filter, CheckCircle2, XCircle, Clock,
  Mail, Loader2, CalendarDays, ChevronDown, RefreshCw, Phone
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  booked_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  discount_code: string | null;
  admin_notes: string | null;
}

interface ConsultationBookingsPanelProps {
  tenantId: string | null;
}

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';
type ResourceFilter = 'all' | 'whisperoo' | 'hospital';

const ConsultationBookingsPanel: React.FC<ConsultationBookingsPanelProps> = ({ tenantId }) => {
  const [bookings, setBookings] = useState<ConsultationBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [resourceFilter, setResourceFilter] = useState<ResourceFilter>('all');
  const [expertFilter, setExpertFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<{ id: string, notes: string } | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<ConsultationBooking | null>(null);
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string | null | undefined>(null);

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
      toast({ title: 'Error', description: 'Failed to load appointment requests', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookings(); }, []);

  // Lazy-load phone number when a booking row is clicked
  const handleRowClick = async (booking: ConsultationBooking) => {
    setSelectedBooking(booking);
    setSelectedPhoneNumber(undefined as any); // "loading" state
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('id', booking.user_id)
        .maybeSingle();
      setSelectedPhoneNumber(data?.phone_number ?? null);
    } catch {
      setSelectedPhoneNumber(null);
    }
  };

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

  const stats = useMemo(() => ({
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
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

  const confirmBooking = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      const { error } = await supabase
        .from('consultation_bookings')
        .update({ status: 'confirmed' })
        .eq('id', bookingId);
      if (error) throw error;

      setBookings(prev => prev.map(b =>
        b.id === bookingId
          ? { ...b, status: 'confirmed' as const }
          : b
      ));
      toast({ title: 'Confirmed', description: 'Appointment has been confirmed.' });
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

  const saveNotes = async (bookingId: string, notes: string) => {
    setActionLoading(`notes-${bookingId}`);
    try {
      const { error } = await supabase
        .from('consultation_bookings')
        .update({ admin_notes: notes })
        .eq('id', bookingId);
      if (error) throw error;

      setBookings(prev => prev.map(b =>
        b.id === bookingId ? { ...b, admin_notes: notes } : b
      ));
      setEditingNotes(null);
      toast({ title: 'Success', description: 'Notes updated.' });
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
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 className="w-3 h-3" /> Confirmed
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
          { id: 'pending' as StatusFilter, label: 'Pending', count: stats.pending },
          { id: 'confirmed' as StatusFilter, label: 'Confirmed', count: stats.confirmed },
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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Total Requests', value: stats.total, color: 'text-gray-900', bg: 'bg-white' },
          { label: 'Pending', value: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Confirmed', value: stats.confirmed, color: 'text-blue-600', bg: 'bg-blue-50' },
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
          <p className="text-gray-500 font-medium">No appointment requests found</p>
          <p className="text-sm text-gray-400 mt-1">
            {search || statusFilter !== 'all' || resourceFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Requests will appear here when patients book consultations'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-3 py-3 font-semibold text-gray-600">Client</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600">Date</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600">Expert</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600">Appointment</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600">Details</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600">Notes</th>
                  <th className="text-center px-3 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((booking) => (
                  <tr
                    key={booking.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer ${
                      booking.status === 'cancelled' ? 'opacity-50' : ''
                    }`}
                    onClick={() => handleRowClick(booking)}
                  >
                    {/* Client + Email (merged) */}
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <p className="font-medium text-gray-900 text-sm">{booking.user_name}</p>
                      <a
                        href={`mailto:${booking.user_email}`}
                        className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate max-w-[140px]">{booking.user_email || '—'}</span>
                      </a>
                    </td>

                    {/* Date */}
                    <td className="px-3 py-3 text-gray-600 text-xs whitespace-nowrap">
                      {formatDate(booking.booked_at)}
                    </td>

                    {/* Expert */}
                    <td className="px-3 py-3 font-medium text-gray-800 text-sm">
                      {booking.expert_name}
                    </td>

                    {/* Appointment Name + Discount Code */}
                    <td className="px-3 py-3 text-gray-700 max-w-[160px]">
                      <span className="line-clamp-1 text-sm">{booking.appointment_name}</span>
                      {booking.discount_code && (
                        <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-md inline-block mt-1">
                          🎟️ {booking.discount_code}
                        </span>
                      )}
                    </td>

                    {/* Payment + Resource + Status (merged) */}
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={booking.status} />
                        <PaymentStatusBadge status={booking.payment_status} amount={booking.amount_paid} />
                        <ResourceBadge type={booking.resource_type} />
                      </div>
                    </td>

                    {/* Admin Notes */}
                    <td className="px-3 py-3 max-w-[180px]" onClick={(e) => e.stopPropagation()}>
                      {editingNotes?.id === booking.id ? (
                        <div className="space-y-1.5">
                          <textarea
                            value={editingNotes.notes}
                            onChange={(e) => setEditingNotes({ ...editingNotes, notes: e.target.value })}
                            className="w-full text-xs p-2 border border-blue-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                            rows={2}
                            placeholder="Coordination notes..."
                          />
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => setEditingNotes(null)}
                              className="px-2 py-1 text-[10px] text-gray-500 hover:bg-gray-100 rounded"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveNotes(booking.id, editingNotes.notes)}
                              disabled={actionLoading === `notes-${booking.id}`}
                              className="px-2 py-1 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div 
                          onClick={() => setEditingNotes({ id: booking.id, notes: booking.admin_notes || '' })}
                          className="group cursor-pointer"
                        >
                          {booking.admin_notes ? (
                            <p className="text-xs text-gray-600 line-clamp-2 italic">"{booking.admin_notes}"</p>
                          ) : (
                            <p className="text-[10px] text-gray-300 italic group-hover:text-blue-400">+ Add notes</p>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      {booking.status === 'pending' ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => confirmBooking(booking.id)}
                            disabled={actionLoading === booking.id}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {actionLoading === booking.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3" />
                            )}
                            Confirm
                          </button>
                          <button
                            onClick={() => cancelBooking(booking.id)}
                            disabled={actionLoading === booking.id}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-3 h-3" />
                            Cancel
                          </button>
                        </div>
                      ) : booking.status === 'confirmed' ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => markComplete(booking.id)}
                            disabled={actionLoading === booking.id}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors disabled:opacity-50"
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
                            className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-3 h-3" />
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <span className="text-[10px] text-gray-400">
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
              Showing {filtered.length} of {bookings.length} requests
            </p>
          </div>
        </div>
      )}

      {/* Booking Details Modal */}
      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Appointment Request Details</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4 mt-2">
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium">Client Name</label>
                  <p className="text-sm font-semibold text-gray-900">{selectedBooking.user_name}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Email Address</label>
                  <a href={`mailto:${selectedBooking.user_email}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-4 h-4" />
                    {selectedBooking.user_email || 'Not provided'}
                  </a>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Phone Number</label>
                  {selectedPhoneNumber ? (
                    <a href={`tel:${selectedPhoneNumber}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1.5 mt-0.5">
                      <Phone className="w-4 h-4" />
                      {selectedPhoneNumber}
                    </a>
                  ) : selectedPhoneNumber === null ? (
                    <p className="text-sm text-gray-400 flex items-center gap-1.5 mt-0.5">
                      <Phone className="w-4 h-4 text-gray-300" />
                      Not provided
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 flex items-center gap-1.5 mt-0.5">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <label className="text-xs text-blue-600/80 font-medium block mb-1">Expert</label>
                  <p className="text-sm font-semibold text-blue-900">{selectedBooking.expert_name}</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <label className="text-xs text-purple-600/80 font-medium block mb-1">Appointment</label>
                  <p className="text-sm font-semibold text-purple-900 line-clamp-2">{selectedBooking.appointment_name}</p>
                </div>
              </div>

              <div className="border border-gray-100 rounded-lg p-3 space-y-2">
                 <div className="flex justify-between items-center text-sm">
                   <span className="text-gray-500">Booked At</span>
                   <span className="font-medium text-gray-900">{formatDate(selectedBooking.booked_at)}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                   <span className="text-gray-500">Status</span>
                   <StatusBadge status={selectedBooking.status} />
                 </div>
                 <div className="flex justify-between items-center text-sm">
                   <span className="text-gray-500">Payment</span>
                   <PaymentStatusBadge status={selectedBooking.payment_status} amount={selectedBooking.amount_paid} />
                 </div>
                 {selectedBooking.discount_code && (
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-gray-500">Discount Code</span>
                     <span className="font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">
                       {selectedBooking.discount_code}
                     </span>
                   </div>
                 )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConsultationBookingsPanel;
