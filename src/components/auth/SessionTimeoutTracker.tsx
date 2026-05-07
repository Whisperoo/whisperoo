import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes for HIPAA compliance

export function useSessionTimeout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    // Only track activity if user is logged in
    if (!user) return;

    const handleTimeout = async () => {
      // Avoid redirect loops if already on auth
      if (location.pathname.startsWith('/auth')) return;

      // Self-heal first: refresh token/session and reload app state.
      const { error } = await supabase.auth.refreshSession();
      if (!error) {
        window.location.reload();
        return;
      }

      // If refresh failed, sign out safely.
      await signOut();
      toast({
        title: 'Session Expired',
        description: 'Your session expired. Please sign in again.',
        variant: 'destructive',
      });
      navigate('/auth/login');
    };

    const resetTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(handleTimeout, TIMEOUT_MS);
    };

    // Initialize timer immediately
    resetTimer();

    // Events that signify user activity
    const activeEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const activityHandler = () => {
      resetTimer();
    };

    activeEvents.forEach(event => {
      window.addEventListener(event, activityHandler, { passive: true });
    });

    const visibilityHandler = async () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
        return;
      }

      // If tab resumes after long idle, refresh and reload to avoid stale-state error storms.
      const hiddenFor = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0;
      if (hiddenFor > 5 * 60 * 1000) {
        const { error } = await supabase.auth.refreshSession();
        if (!error) {
          window.location.reload();
        }
      }
    };

    document.addEventListener('visibilitychange', visibilityHandler);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      activeEvents.forEach(event => {
        window.removeEventListener(event, activityHandler);
      });
      document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [user, signOut, navigate, location.pathname]);
}

export function SessionTimeoutTracker() {
  useSessionTimeout();
  return null;
}
