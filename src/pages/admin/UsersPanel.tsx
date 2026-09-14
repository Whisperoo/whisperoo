import React, { useCallback, useEffect, useState } from 'react';
import { Search, Loader2, RefreshCw, ChevronLeft, ChevronRight, Building2, User, MessageSquare, Eye, Download, ShoppingBag, CalendarCheck, X, Activity, CheckSquare, Bookmark } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import type { AdminSegment } from './HospitalSelector';

/**
 * Users tab — Sprint 2 (QUO-2026-004) workstream 1: "User list view filterable
 * by segment". Driven by the portal's scope selector, so it always agrees with
 * the Metrics tab about who counts as Hospital vs Direct.
 *
 * Deliberately shows NO direct identifiers (HIPAA 6.1): no email, no phone. First
 * name is the minimum a human needs to recognise a row. Contact details are
 * export-only, through the audited path — never a browsable grid.
 */

interface UserRow {
  id: string;
  first_name: string | null;
  account_type: string | null;
  onboarded: boolean;
  tenant_id: string | null;
  tenant_name: string | null;
  segment: 'hospital' | 'b2c';
  acquisition_source: string | null;
  acquisition_department: string | null;
  hospital_affiliation: string | null;
  preferred_language: string | null;
  created_at: string;
  total_count: number;
}

interface ActivitySummary {
  user_id: string;
  last_active_at: string | null;
  chat_sessions: number;
  messages_sent: number;
  resources_viewed: number;
  resources_downloaded: number;
  resources_saved: number;
  purchases: number;
  bookings: number;
  checklist_done: number;
}

interface TimelineEvent {
  occurred_at: string;
  event_type: string;
  detail: string | null;
}

interface UsersPanelProps {
  tenantId: string | null;
  segment: AdminSegment;
}

const PAGE_SIZE = 50;

const UsersPanel: React.FC<UsersPanelProps> = ({ tenantId, segment }) => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(0);
  // Activity is a second, batched call keyed by the ids on the current page, so
  // the user list renders immediately and the counts fill in a moment later.
  const [activity, setActivity] = useState<Record<string, ActivitySummary>>({});
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[] | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Debounce the search box so we do not hit the RPC on every keystroke.
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);

  // Any filter change resets to the first page — page N of a different result
  // set is meaningless.
  useEffect(() => { setPage(0); }, [tenantId, segment, debouncedSearch, startDate, endDate]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('fn_admin_list_users', {
        p_tenant_id: tenantId ?? null,
        p_segment: segment,
        p_start_date: startDate || null,
        p_end_date: endDate || null,
        p_search: debouncedSearch || null,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      });
      if (rpcError) throw rpcError;
      const list = (data as UserRow[]) ?? [];
      setRows(list);
      setTotal(list[0]?.total_count ?? 0);

      // Activity types and counts only -- HIPAA 6.1. Fail-soft: a missing
      // activity column is better than a missing user list.
      if (list.length > 0) {
        const { data: act, error: actErr } = await supabase.rpc('fn_admin_user_activity_summary', {
          p_user_ids: list.map((u) => u.id),
        });
        if (actErr) {
          console.warn('Activity summary unavailable:', actErr);
          setActivity({});
        } else {
          const map: Record<string, ActivitySummary> = {};
          for (const a of (act as ActivitySummary[]) ?? []) map[a.user_id] = a;
          setActivity(map);
        }
      } else {
        setActivity({});
      }
    } catch (err: unknown) {
      console.error('Error loading users:', err);
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [tenantId, segment, startDate, endDate, debouncedSearch, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openUser = async (u: UserRow) => {
    setSelected(u);
    setTimeline(null);
    setTimelineLoading(true);
    const { data: tl, error: tlErr } = await supabase.rpc('fn_admin_user_timeline', { p_user_id: u.id, p_limit: 100 });
    if (tlErr) {
      console.warn('Timeline unavailable:', tlErr);
      setTimeline([]);
    } else {
      setTimeline((tl as TimelineEvent[]) ?? []);
    }
    setTimelineLoading(false);
  };

  const relative = (iso: string | null) => {
    if (!iso) return t('admin.users.never', 'Never');
    const d = (Date.now() - new Date(iso).getTime()) / 86400000;
    if (d < 1) return t('admin.users.today', 'Today');
    if (d < 2) return t('admin.users.yesterday', 'Yesterday');
    if (d < 30) return t('admin.users.daysAgo', '{{n}}d ago', { n: Math.floor(d) });
    return new Date(iso).toLocaleDateString();
  };

  const eventLabel = (e: string) => ({
    app_open:          t('admin.users.ev.appOpen', 'Opened the app'),
    chat_session:      t('admin.users.ev.chatSession', 'Started a chat'),
    chat_message:      t('admin.users.ev.chatMessage', 'Sent a message'),
    resource_view:     t('admin.users.ev.view', 'Viewed'),
    resource_download: t('admin.users.ev.download', 'Downloaded'),
    resource_saved:    t('admin.users.ev.saved', 'Saved'),
    purchase:          t('admin.users.ev.purchase', 'Purchased'),
    booking:           t('admin.users.ev.booking', 'Booked'),
    checklist_done:    t('admin.users.ev.checklist', 'Completed a checklist item'),
  } as Record<string, string>)[e] ?? e;

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);

  const affiliationLabel = (v: string | null) => {
    switch (v) {
      case 'hospital':    return t('admin.users.affiliation.hospital', 'Said hospital');
      case 'independent': return t('admin.users.affiliation.independent', 'Said independent');
      case 'skipped':     return t('admin.users.affiliation.skipped', 'Skipped');
      default:            return t('admin.users.affiliation.notAsked', 'Not asked');
    }
  };

  const inputCls = 'text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none';
  const labelCls = 'text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-1 block';

  return (
    <div className="space-y-6">
      {/* ── Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col">
            <label htmlFor="users-search" className={labelCls}>{t('admin.users.search', 'Search')}</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                id="users-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('admin.users.searchHint', 'Name or hospital')}
                className={`${inputCls} pl-7 w-52`}
              />
            </div>
          </div>
          <div className="flex flex-col">
            <label htmlFor="users-start" className={labelCls}>{t('admin.users.startDate', 'Signed up from')}</label>
            <input id="users-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <div className="flex flex-col">
            <label htmlFor="users-end" className={labelCls}>{t('admin.users.endDate', 'To')}</label>
            <input id="users-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
          </div>
        </div>
        <button onClick={fetchUsers} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> {t('admin.metrics.refresh')}
        </button>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-[16px] border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-[15px] font-semibold text-gray-900">{t('admin.users.title', 'Users')}</h3>
            <p className="text-xs text-gray-400">
              {t('admin.users.subtitle', 'No contact details are shown here. Use the exports for those.')}
            </p>
          </div>
          <div className="text-xs text-gray-500">
            <span className="font-semibold text-gray-800">{total.toLocaleString()}</span> {t('admin.users.total', 'total')}
          </div>
        </div>

        {error ? (
          <div className="px-6 py-10 text-center text-sm text-red-600">{error}</div>
        ) : loading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('admin.users.loading', 'Loading users…')}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500">
            {t('admin.users.empty', 'No users match the current filters.')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">{t('admin.users.col.name', 'First name')}</th>
                  <th className="px-4 py-3">{t('admin.users.col.segment', 'Segment')}</th>
                  <th className="px-4 py-3">{t('admin.users.col.hospital', 'Hospital')}</th>
                  <th className="px-4 py-3">{t('admin.users.col.type', 'Type')}</th>
                  <th className="px-4 py-3">{t('admin.users.col.source', 'Source')}</th>
                  <th className="px-4 py-3">{t('admin.users.col.affiliation', 'Onboarding answer')}</th>
                  <th className="px-4 py-3">{t('admin.users.col.lang', 'Lang')}</th>
                  <th className="px-4 py-3">{t('admin.users.col.onboarded', 'Onboarded')}</th>
                  <th className="px-4 py-3">{t('admin.users.col.lastActive', 'Last active')}</th>
                  <th className="px-4 py-3">{t('admin.users.col.activity', 'Activity')}</th>
                  <th className="px-4 py-3 text-right">{t('admin.users.col.signedUp', 'Signed up')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((u) => (
                  <tr key={u.id} onClick={() => openUser(u)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3 text-gray-900 font-medium">{u.first_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded ${u.segment === 'hospital' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {u.segment === 'hospital' ? <Building2 className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        {u.segment === 'hospital' ? t('admin.hospital.scope.hospitalsLabel') : t('admin.hospital.scope.directLabel')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.tenant_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{u.account_type || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {u.acquisition_source || '—'}
                      {u.acquisition_department && <span className="text-gray-400"> · {u.acquisition_department}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{affiliationLabel(u.hospital_affiliation)}</td>
                    <td className="px-4 py-3 text-gray-600 uppercase">{u.preferred_language || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${u.onboarded ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.onboarded ? t('admin.users.yes', 'Yes') : t('admin.users.no', 'No')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{relative(activity[u.id]?.last_active_at ?? null)}</td>
                    <td className="px-4 py-3">
                      {activity[u.id] ? (
                        <div className="flex items-center gap-2.5 text-[11px] text-gray-600">
                          <span className="inline-flex items-center gap-0.5" title={t('admin.users.ev.chatSession', 'Started a chat')}><MessageSquare className="w-3 h-3 text-gray-400" />{activity[u.id].chat_sessions}</span>
                          <span className="inline-flex items-center gap-0.5" title={t('admin.users.ev.view', 'Viewed')}><Eye className="w-3 h-3 text-gray-400" />{activity[u.id].resources_viewed}</span>
                          <span className="inline-flex items-center gap-0.5" title={t('admin.users.ev.purchase', 'Purchased')}><ShoppingBag className="w-3 h-3 text-gray-400" />{activity[u.id].purchases}</span>
                          <span className="inline-flex items-center gap-0.5" title={t('admin.users.ev.booking', 'Booked')}><CalendarCheck className="w-3 h-3 text-gray-400" />{activity[u.id].bookings}</span>
                        </div>
                      ) : <span className="text-gray-300">…</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-right whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 text-xs text-gray-500">
            <span>{t('admin.users.showing', 'Showing')} {from}–{to} {t('admin.users.of', 'of')} {total.toLocaleString()}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || loading}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40" aria-label="Previous page">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2">{page + 1} / {pageCount}</span>
              <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1 || loading}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40" aria-label="Next page">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User drawer: activity breakdown + timeline. Types and dates only. */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
          <button aria-label="Close" onClick={() => setSelected(null)} className="absolute inset-0 bg-black/30" />
          <aside className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col">
            <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selected.first_name || '—'}</h3>
                <p className="text-xs text-gray-500">
                  {selected.tenant_name || t('admin.hospital.scope.directLabel')} · {t('admin.users.col.signedUp', 'Signed up')} {new Date(selected.created_at).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {activity[selected.id] && (
              <div className="grid grid-cols-4 gap-2 px-6 py-4 border-b border-gray-100">
                {([
                  [MessageSquare, activity[selected.id].chat_sessions, t('admin.users.stat.chats', 'Chats')],
                  [Eye, activity[selected.id].resources_viewed, t('admin.users.stat.viewed', 'Viewed')],
                  [Download, activity[selected.id].resources_downloaded, t('admin.users.stat.downloaded', 'Downloaded')],
                  [Bookmark, activity[selected.id].resources_saved, t('admin.users.stat.saved', 'Saved')],
                  [ShoppingBag, activity[selected.id].purchases, t('admin.users.stat.purchases', 'Purchases')],
                  [CalendarCheck, activity[selected.id].bookings, t('admin.users.stat.bookings', 'Bookings')],
                  [CheckSquare, activity[selected.id].checklist_done, t('admin.users.stat.checklist', 'Checklist')],
                  [Activity, activity[selected.id].messages_sent, t('admin.users.stat.messages', 'Messages')],
                ] as Array<[typeof Eye, number, string]>).map(([Icon, n, label]) => (
                  <div key={label} className="rounded-lg bg-gray-50 p-2 text-center">
                    <Icon className="w-3.5 h-3.5 text-gray-400 mx-auto mb-0.5" />
                    <div className="text-sm font-semibold text-gray-900 tabular-nums">{n}</div>
                    <div className="text-[10px] text-gray-500">{label}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-3">
                {t('admin.users.timeline', 'Timeline')}
              </p>
              {timelineLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> {t('admin.users.loading', 'Loading…')}</div>
              ) : !timeline || timeline.length === 0 ? (
                <p className="text-sm text-gray-400">{t('admin.users.noActivity', 'No activity recorded yet.')}</p>
              ) : (
                <ol className="space-y-2.5">
                  {timeline.map((ev, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="text-xs text-gray-400 whitespace-nowrap w-20 pt-0.5 tabular-nums">{new Date(ev.occurred_at).toLocaleDateString()}</span>
                      <span className="text-gray-700">
                        {eventLabel(ev.event_type)}
                        {ev.detail && <span className="text-gray-500"> — {ev.detail}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-6 text-[11px] text-gray-400">
                {t('admin.users.privacyNote', 'Activity types and dates only. Chat content is never shown here.')}
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default UsersPanel;
