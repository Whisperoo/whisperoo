import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, X, Eye, Mail, MessageSquare, Users, Inbox, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import type { AdminSegment } from './HospitalSelector';
import StatusPill from '@/components/admin/StatusPill';
import type { StatusTone } from '@/lib/statusTones';
import { relativeTime, exactTime } from '@/lib/relativeTime';
import { useInvalidateSupportCounts } from '@/hooks/useAdminSupportCounts';

/**
 * Support Requests — the team's queue for the parent-side "Get Support" card.
 *
 * Order: urgent first, then oldest first. Urgent = the parent's text tripped the
 * escalation keywords or OpenAI Moderation; they were shown crisis resources
 * instead of an AI reply, and the team should reach out first.
 *
 * The team sources help off-platform (client, 2026-10-07), so this view is for
 * reading requests, getting contact details, and moving them through
 * new → in progress → done. Marking done removes the "We've got you" card from the
 * parent's dashboard.
 *
 * Contact details are NOT in the list: "Show contact" calls an audited RPC that
 * writes a phi_access_log row each time.
 */

type Status = 'new' | 'in_progress' | 'done';
type Filter = 'open' | 'done' | 'all';

interface RequestRow {
  id: string;
  user_id: string;
  first_name: string | null;
  tenant_name: string | null;
  topic: string | null;
  request_text: string;
  answers: Record<string, string>;
  empathy_reply: string | null;
  language: string;
  is_urgent: boolean;
  urgent_reason: string | null;
  status: Status;
  parent_emailed_at: string | null;
  parent_texted_at: string | null;
  team_alerted_at: string | null;
  done_at: string | null;
  created_at: string;
  total_count: number;
}

interface Props {
  tenantId: string | null;
  segment: AdminSegment;
}

const PAGE_SIZE = 50;

// Portal-wide palette (lib/statusTones): new = needs action, in progress = being
// worked on, done = finished. Urgent is shown separately in red.
const STATUS_TONE: Record<Status, StatusTone> = {
  new: 'new',
  in_progress: 'active',
  done: 'done',
};

const ANSWER_LABEL: Record<string, string> = {
  support_type: 'Support type',
  insurance: 'Insurance',
  provider: 'Provider',
  notes: 'Notes',
};

const SupportRequestsPanel: React.FC<Props> = ({ tenantId, segment }) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('open');
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RequestRow | null>(null);
  // Bulk selection (ids on the current page). Cleared whenever the list reloads.
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<Status | null>(null);
  const invalidateCounts = useInvalidateSupportCounts();
  const { i18n } = useTranslation();
  const locale = i18n.language;

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('fn_admin_list_support_requests', {
      p_status: filter,
      p_tenant_id: tenantId ?? null,
      p_segment: segment,
      p_limit: PAGE_SIZE,
      p_offset: page * PAGE_SIZE,
    });
    if (error) {
      console.error('Support requests load failed:', error);
      toast.error(t('admin.support.loadFailed', 'Could not load support requests.'));
      setRows([]);
      setTotal(0);
    } else {
      const list = (data as RequestRow[]) ?? [];
      setRows(list);
      setTotal(list[0]?.total_count ?? 0);
    }
    setChecked(new Set());
    setLoading(false);
  }, [filter, tenantId, segment, page, t]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [filter, tenantId, segment]);

  const filters: Array<[Filter, string]> = [
    ['open', t('admin.support.filter.open', 'Open')],
    ['done', t('admin.support.filter.done', 'Done')],
    ['all', t('admin.support.filter.all', 'All')],
  ];

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const allChecked = rows.length > 0 && rows.every((r) => checked.has(r.id));
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(rows.map((r) => r.id)));

  const bulkSet = async (status: Status) => {
    if (checked.size === 0) return;
    setBulkBusy(status);
    const { data, error } = await supabase.rpc('fn_admin_set_support_request_status_bulk', {
      p_ids: Array.from(checked),
      p_status: status,
    });
    setBulkBusy(null);
    if (error) {
      console.error('Bulk status update failed:', error);
      toast.error(error.message);
      return;
    }
    toast.success(t('admin.support.bulkDone', '{{count}} request(s) updated.', { count: Number(data ?? 0) }));
    invalidateCounts();
    load();
  };

  const emptyText: Record<Filter, string> = {
    open: t('admin.support.emptyOpen', "All caught up — no open requests. New ones from the Get Support card will appear here, urgent first."),
    done: t('admin.support.emptyDone', 'Nothing marked done yet. Requests you finish will move here.'),
    all: t('admin.support.emptyAll', 'No support requests yet. When a parent uses Get Support, their request will appear here.'),
  };

  const statusLabel = (s: Status) =>
    ({ new: t('admin.support.status.new', 'New'), in_progress: t('admin.support.status.inProgress', 'In progress'), done: t('admin.support.status.done', 'Done') })[s];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-[16px] border border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-[15px] font-semibold text-gray-900">{t('admin.support.title', 'Support Requests')}</h3>
            <p className="text-xs text-gray-400">
              {t('admin.support.subtitle', 'From the Get Support card. Urgent first, then oldest first.')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-200 p-0.5">
              {filters.map(([f, label]) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md ${filter === f ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {checked.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-6 py-3 bg-blue-50/60 border-b border-blue-100 text-sm">
            <span className="font-semibold text-gray-900">
              {t('admin.support.selected', '{{count}} selected', { count: checked.size })}
            </span>
            <span className="flex-1" />
            <button onClick={() => bulkSet('in_progress')} disabled={bulkBusy !== null}
              className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 disabled:opacity-60 inline-flex items-center gap-1.5">
              {bulkBusy === 'in_progress' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t('admin.support.markInProgress', 'Mark in progress')}
            </button>
            <button onClick={() => bulkSet('done')} disabled={bulkBusy !== null}
              className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold disabled:opacity-60 inline-flex items-center gap-1.5">
              {bulkBusy === 'done' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t('admin.support.markDone', 'Mark done')}
            </button>
            <button onClick={() => setChecked(new Set())} className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700">
              {t('common.clear', 'Clear')}
            </button>
          </div>
        )}

        {loading ? (
          <ul className="divide-y divide-gray-100" aria-busy="true" aria-label={t('admin.users.loading', 'Loading…')}>
            {[0, 1, 2].map((i) => (
              <li key={i} className="px-6 py-4 flex gap-4 animate-pulse">
                <div className="w-4 h-4 rounded bg-gray-100 mt-1" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded bg-gray-100" />
                  <div className="h-3 w-2/3 rounded bg-gray-100" />
                </div>
              </li>
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            {filter === 'open'
              ? <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
              : <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-3" />}
            <p className="text-sm text-gray-500 max-w-sm mx-auto">{emptyText[filter]}</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            <li className="px-6 py-2 flex items-center gap-3 bg-gray-50/60 text-xs text-gray-500">
              <input type="checkbox" checked={allChecked} onChange={toggleAll}
                aria-label={t('admin.support.selectAll', 'Select all on this page')}
                className="h-4 w-4 rounded border-gray-300" />
              {t('admin.support.selectAll', 'Select all on this page')}
            </li>
            {rows.map((r) => (
              <li key={r.id} className={`flex items-start gap-3 px-6 py-4 hover:bg-gray-50 ${checked.has(r.id) ? 'bg-blue-50/40' : ''}`}>
                <input type="checkbox" checked={checked.has(r.id)} onChange={() => toggle(r.id)}
                  aria-label={t('admin.support.selectOne', 'Select request from {{name}}', { name: r.first_name || '—' })}
                  className="h-4 w-4 rounded border-gray-300 mt-1" />
                <button onClick={() => setSelected(r)} className="flex-1 min-w-0 text-left">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {r.is_urgent && (
                      <StatusPill tone="urgent">
                        <AlertTriangle className="w-3 h-3" /> {t('admin.support.urgent', 'Urgent')}
                      </StatusPill>
                    )}
                    <StatusPill tone={STATUS_TONE[r.status]}>{statusLabel(r.status)}</StatusPill>
                    <span className="text-sm font-semibold text-gray-900">{r.first_name || '—'}</span>
                    <span className="text-xs text-gray-400">
                      {r.tenant_name || t('admin.hospital.scope.directLabel', 'Direct')} · {r.topic || '—'} ·{' '}
                      <time dateTime={r.created_at} title={exactTime(r.created_at, locale)}>
                        {relativeTime(r.created_at, locale)}
                      </time>
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-2">{r.request_text}</p>
                </button>
              </li>
            ))}
          </ul>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 text-xs text-gray-500">
            <span>{page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} / {total}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40" aria-label="Previous page">‹</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total} className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40" aria-label="Next page">›</button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <RequestDrawer
          request={selected}
          statusLabel={statusLabel}
          onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); invalidateCounts(); load(); }}
        />
      )}
    </div>
  );
};

interface DrawerProps {
  request: RequestRow;
  statusLabel: (s: Status) => string;
  onClose: () => void;
  onSaved: () => void;
}

const RequestDrawer: React.FC<DrawerProps> = ({ request, statusLabel, onClose, onSaved }) => {
  const { t, i18n } = useTranslation();
  const [contact, setContact] = useState<{ email: string | null; phone: string | null } | null>(null);
  const [contactLoading, setContactLoading] = useState(false);
  const [saving, setSaving] = useState<Status | null>(null);

  const showContact = async () => {
    setContactLoading(true);
    const { data, error } = await supabase.rpc('fn_admin_support_request_contact', { p_id: request.id });
    setContactLoading(false);
    if (error) {
      console.error('Support contact reveal failed:', error);
      toast.error(t('admin.support.contactFailed', 'Could not load contact details.'));
      return;
    }
    const row = (data as Array<{ email: string | null; phone: string | null }>)?.[0];
    setContact(row ?? { email: null, phone: null });
  };

  const setStatus = async (status: Status) => {
    setSaving(status);
    const { error } = await supabase.rpc('fn_admin_set_support_request_status', { p_id: request.id, p_status: status });
    setSaving(null);
    if (error) {
      console.error('Support request status update failed:', error);
      toast.error(error.message);
      return;
    }
    toast.success(t('admin.support.saved', 'Request updated.'));
    onSaved();
  };

  const sent = (at: string | null) =>
    at ? `${t('admin.support.sent', 'sent')} ${relativeTime(at, i18n.language)} (${exactTime(at, i18n.language)})` : t('admin.support.notSent', 'not sent');

  const actions: Array<[Status, string]> = [
    ['in_progress', t('admin.support.markInProgress', 'Mark in progress')],
    ['done', t('admin.support.markDone', 'Mark done')],
    ['new', t('admin.support.markNew', 'Move back to new')],
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/30" />
      <aside className="relative w-full max-w-lg h-full bg-white shadow-2xl flex flex-col">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{request.first_name || '—'}</h3>
            <p className="text-xs text-gray-500">
              <StatusPill tone={STATUS_TONE[request.status]} className="mr-1.5">{statusLabel(request.status)}</StatusPill>
              {request.tenant_name || t('admin.hospital.scope.directLabel', 'Direct')} · {request.topic || '—'} · {request.language.toUpperCase()} ·{' '}
              <time dateTime={request.created_at} title={exactTime(request.created_at, i18n.language)}>
                {relativeTime(request.created_at, i18n.language)}
              </time>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {request.is_urgent && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <div className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> {t('admin.support.urgentTitle', 'Urgent — reach out first')}</div>
              <p className="text-xs mt-1">{request.urgent_reason}</p>
              <p className="text-xs mt-1">{t('admin.support.urgentShown', 'The parent was shown crisis resources (911 / 988 / their provider), not an AI reply.')}</p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-1.5">{t('admin.support.request', 'Request')}</p>
            <p className="text-sm text-gray-900 whitespace-pre-line break-words">{request.request_text}</p>
          </div>

          {Object.keys(request.answers ?? {}).length > 0 && (
            <dl className="text-sm divide-y divide-gray-100 border-y border-gray-100">
              {Object.entries(request.answers).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2">
                  <dt className="text-gray-500 flex-shrink-0">{ANSWER_LABEL[k] ?? k}</dt>
                  <dd className="text-gray-900 text-right break-words min-w-0">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          <div>
            {contact ? (
              <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm">
                <div><span className="text-gray-500">Email:</span> {contact.email || '—'}</div>
                <div><span className="text-gray-500">Phone:</span> {contact.phone || '—'}</div>
                <p className="text-[11px] text-gray-400 mt-1">{t('admin.support.contactLogged', 'This view was recorded in the PHI access log.')}</p>
              </div>
            ) : (
              <button onClick={showContact} disabled={contactLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                {contactLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                {t('admin.support.showContact', 'Show contact (logged)')}
              </button>
            )}
          </div>

          <div className="text-xs text-gray-500 space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-1">{t('admin.support.messages', 'Messages on submit')}</p>
            <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {t('admin.support.parentEmail', 'Parent email')}: {sent(request.parent_emailed_at)}</p>
            <p className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> {t('admin.support.parentSms', 'Parent SMS (opted-in only)')}: {sent(request.parent_texted_at)}</p>
            <p className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {t('admin.support.teamAlert', 'Team alert')}: {sent(request.team_alerted_at)}</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap justify-end gap-2">
          {actions.filter(([s]) => s !== request.status).map(([s, label]) => (
            <button key={s} onClick={() => setStatus(s)} disabled={saving !== null}
              className={`px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60 ${s === 'done' ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
              {saving === s && <Loader2 className="w-4 h-4 animate-spin" />}
              {label}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
};

export default SupportRequestsPanel;
