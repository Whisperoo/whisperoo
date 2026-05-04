import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes for HIPAA compliance

export function useSessionTimeout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only track activity if user is logged in
    if (!user) return;

    const handleTimeout = async () => {
      // Avoid redirect loops if already on auth
      if (location.pathname.startsWith('/auth')) return;
      
      await signOut();
      
      toast({
        title: 'Session Expired',
        description: 'You have been automatically logged out due to 15 minutes of inactivity for security and privacy.',
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

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      activeEvents.forEach(event => {
        window.removeEventListener(event, activityHandler);
      });
    };
  }, [user, signOut, navigate, location.pathname]);
}

export function SessionTimeoutTracker() {
  useSessionTimeout();
  return null;
}
