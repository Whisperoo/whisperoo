import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function useAppointmentNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`global-booking-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'consultation_bookings',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const status = (payload.new as any)?.status as string | undefined;
          if (status === 'confirmed') {
            toast({
              title: 'Appointment Confirmed',
              description: 'Your appointment request has been confirmed by the expert.',
            });
          } else if (status === 'completed') {
            toast({
              title: 'Appointment Completed',
              description: 'Your appointment has been marked as completed.',
            });
          } else if (status === 'cancelled') {
            toast({
              title: 'Appointment Cancelled',
              description: 'Your appointment has been cancelled.',
              variant: 'destructive',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
}
