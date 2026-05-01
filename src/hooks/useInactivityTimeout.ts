import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

// HIPAA Stage 1: 30-minute inactivity timeout
const TIMEOUT_MINUTES = 30;
const WARNING_MINUTES = 25;
const TIMEOUT_MS = TIMEOUT_MINUTES * 60 * 1000;
const WARNING_MS = WARNING_MINUTES * 60 * 1000;

export const useInactivityTimeout = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const lastActivity = useRef<number>(Date.now());
  const [showWarning, setShowWarning] = useState(false);
  const warningTimer = useRef<NodeJS.Timeout | null>(null);
  const timeoutTimer = useRef<NodeJS.Timeout | null>(null);

  // Reset the activity timestamp and restart timers
  const resetActivity = () => {
    lastActivity.current = Date.now();
    
    // If the warning was showing but they moved, hide it and toast a welcome back
    if (showWarning) {
      setShowWarning(false);
      toast({
        title: t('auth.timeout.sessionExtended', 'Session Extended'),
        description: t('auth.timeout.activeAgain', "We've extended your session."),
      });
    }

    startTimers();
  };

  const startTimers = () => {
    // Clear existing
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (timeoutTimer.current) clearTimeout(timeoutTimer.current);

    // Only run timers if the user is logged in
    if (!user) return;

    // Set warning timer (e.g., 25 mins)
    warningTimer.current = setTimeout(() => {
      setShowWarning(true);
      toast({
        title: t('auth.timeout.warningTitle', 'Session Expiring Soon'),
        description: t('auth.timeout.warningDesc', 'Your session will expire in 5 minutes due to inactivity. Please interact with the page to stay logged in.'),
        variant: 'destructive',
        duration: 300000, // Show for 5 mins
      });
    }, WARNING_MS);

    // Set absolute timeout timer (e.g., 30 mins)
    timeoutTimer.current = setTimeout(async () => {
      console.log('HIPAA Inactivity Timeout Reached. Logging out.');
      
      // Execute sign out
      await supabase.auth.signOut();
      
      toast({
        title: t('auth.timeout.expiredTitle', 'Session Expired'),
        description: t('auth.timeout.expiredDesc', 'For your security, you have been logged out due to inactivity.'),
      });
      
      navigate('/auth/login');
    }, TIMEOUT_MS);
  };

  // Setup event listeners
  useEffect(() => {
    if (!user) return;

    // Start timers initially
    startTimers();

    // Events that count as "activity"
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    
    // Throttled event handler to prevent performance issues
    let throttleTimeout: NodeJS.Timeout | null = null;
    const handleActivity = () => {
      if (!throttleTimeout) {
        resetActivity();
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
        }, 5000); // Only reset at most once every 5 seconds
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (warningTimer.current) clearTimeout(warningTimer.current);
      if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [user]);

  return { showWarning };
};
