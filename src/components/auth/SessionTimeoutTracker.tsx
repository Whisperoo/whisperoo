import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

// Policy: 15-minute inactivity timeout. This module is the single source of truth for session expiry.
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

    // Refresh the token in place. A full page reload here used to be the way to
    // avoid stale-token request failures, but it also discarded whatever the user
    // had on screen (admin scope, date range, open drawer). The refreshed session
    // propagates through onAuthStateChange, so nothing needs to be reloaded.
    const expireSession = async () => {
      await signOut();
      toast({
        title: 'Session Expired',
        description: 'Your session expired. Please sign in again.',
        variant: 'destructive',
      });
      navigate('/auth/login');
    };

    const handleTimeout = async () => {
      // Avoid redirect loops if already on auth
      if (location.pathname.startsWith('/auth')) return;

      const { error } = await supabase.auth.refreshSession();
      if (error) await expireSession();
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

      // Tab resumed after a long idle: refresh the token in place (no reload).
      const hiddenFor = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0;
      if (hiddenFor > 5 * 60 * 1000 && !location.pathname.startsWith('/auth')) {
        const { error } = await supabase.auth.refreshSession();
        if (error) await expireSession();
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
