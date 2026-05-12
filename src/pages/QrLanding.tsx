import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { isComingSoonTenant } from '@/config/comingSoon';

const QR_ANON_STORAGE_KEY = 'whisperoo-qr-anon-id';

function getOrCreateAnonId(): string {
  if (typeof window === 'undefined') return '';
  const existing = window.localStorage.getItem(QR_ANON_STORAGE_KEY);
  if (existing) return existing;
  const next = crypto.randomUUID();
  window.localStorage.setItem(QR_ANON_STORAGE_KEY, next);
  return next;
}

const QrLanding: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const [error, setError] = useState<string | null>(null);
  const safeToken = useMemo(() => (token || '').trim(), [token]);

  useEffect(() => {
    if (!safeToken) {
      navigate('/auth/create', { replace: true });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const anonId = getOrCreateAnonId();

        const { data, error: lookupErr } = await supabase
          .from('qr_codes')
          .select('id, token, source, department, tenants:tenant_id ( id, slug )')
          .eq('token', safeToken)
          .eq('is_active', true)
          .single();

        if (lookupErr) throw lookupErr;
        if (!data?.tenants?.slug) throw new Error('Invalid QR code');

        // Best-effort scan log (fail-soft)
        await supabase.from('qr_events').insert({
          qr_code_id: data.id,
          event_type: 'scan',
          anon_id: anonId || null,
          metadata: {
            token: data.token,
            referrer: typeof document !== 'undefined' ? document.referrer : null,
            path: typeof window !== 'undefined' ? window.location.pathname : null,
          },
        });

        if (cancelled) return;

        const params = new URLSearchParams();
        params.set('tenant', data.tenants.slug);
        if (data.source) params.set('source', data.source);
        if (data.department) params.set('dept', data.department);
        params.set('qr', data.token);

        const destination = isComingSoonTenant(data.tenants.slug)
          ? `/coming-soon?${params.toString()}`
          : `/auth/create?${params.toString()}`;
        navigate(destination, { replace: true });
      } catch (e: any) {
        console.error('QR landing failed:', e);
        if (!cancelled) {
          setError(e?.message || 'Invalid QR code');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, safeToken]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 w-full max-w-md text-center space-y-2">
        <p className="text-sm font-semibold text-gray-900">Redirecting…</p>
        <p className="text-xs text-gray-500">
          {error ? error : 'Taking you to the correct signup flow.'}
        </p>
        {error && (
          <button
            className="text-xs text-blue-600 underline"
            onClick={() => navigate('/auth/create', { replace: true })}
          >
            Continue to signup
          </button>
        )}
      </div>
    </div>
  );
};

export default QrLanding;

