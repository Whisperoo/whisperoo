import React, { useEffect, useState, useCallback } from 'react';
import { Search, Download, RefreshCw, Shield, AlertTriangle, Calendar, X, MessageSquare, Bot } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useTranslation } from 'react-i18next';

interface AuditRow {
  message_id: string;
  created_at: string;
  user_id: string;
  cohort: string;
  category: string;
  summary: string;
  escalation: boolean;
}

interface AuditTrailTableProps {
  tenantId: string | null;
}

const PAGE_SIZE = 50;

const AuditTrailTable: React.FC<AuditTrailTableProps> = ({ tenantId }) => {
  const [rows, setRows]                     = useState<AuditRow[]>([]);
  const [filtered, setFiltered]             = useState<AuditRow[]>([]);
  const [search, setSearch]                 = useState('');
  const [dateFrom, setDateFrom]             = useState('');
  const [dateTo, setDateTo]                 = useState('');
  const [escalationOnly, setEscalationOnly] = useState(false);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [selectedRow, setSelectedRow]       = useState<AuditRow | null>(null);
  const [conversation, setConversation]     = useState<any[]>([]);
  const [loadingConv, setLoadingConv]       = useState(false);
  const [reasonSubmitted, setReasonSubmitted] = useState(false);
  const [reasonCode, setReasonCode] = useState<'user_reported_issue' | 'quality_review' | 'debugging' | 'other'>('quality_review');
  const [reasonText, setReasonText] = useState('');
  const [recentAccess, setRecentAccess] = useState<any[]>([]);
  const { t } = useTranslation();

  const openConversation = async (row: AuditRow) => {
    setSelectedRow(row);
    setConversation([]);
    setRecentAccess([]);
    setReasonSubmitted(false);
    setReasonCode('quality_review');
    setReasonText('');
  };

  const submitReasonAndLoadConversation = async () => {
    if (!selectedRow) return;
    if (reasonCode === 'other' && !reasonText.trim()) return;

    setLoadingConv(true);
    setConversation([]);
    setRecentAccess([]);
    try {
      const { data, error } = await supabase.functions.invoke('admin_phi_conversation', {
        body: {
          message_id: selectedRow.message_id,
          action: 'view_conversation',
          reason_code: reasonCode,
          reason_text: reasonText.trim() || undefined,
        },
      });
      if (error) throw error;
      setConversation(data?.messages || []);
      setRecentAccess(data?.recent_access || []);
      setReasonSubmitted(true);
    } catch (e) {
      console.error('Error fetching conversation via compliance gate:', e);
      setReasonSubmitted(false);
    } finally {
      setLoadingConv(false);
    }
  };

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('admin_ai_audit_trail')
      .select('message_id, created_at, user_id, cohort, category, summary, escalation, tenant_id')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (tenantId)        query = query.eq('tenant_id', tenantId);
    if (escalationOnly)  query = query.eq('escalation', true);
    if (dateFrom) {
      query = query.gte('created_at', new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      query = query.lte('created_at', end.toISOString());
    }

    const { data, error: qErr } = await query;
    if (qErr) {
      setError(qErr.message);
    } else {
      setRows(data ?? []);
      setFiltered(data ?? []);
    }
    setLoading(false);
  }, [tenantId, dateFrom, dateTo, escalationOnly]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Client-side text search (runs on top of server-side date/escalation filters)
  useEffect(() => {
    if (!search.trim()) { setFiltered(rows); return; }
    const q = search.toLowerCase();
    setFiltered(
      rows.filter(
        (r) =>
          r.cohort.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.summary.toLowerCase().includes(q)
      )
    );
  }, [search, rows]);

  // CSV export — includes all currently-filtered rows
  const exportCsv = () => {
    const headers = ['ID', 'TIMESTAMP', 'USER ID', 'COHORT', 'CATEGORY', 'SUMMARY', 'ESCALATION'];
    const csvRows = filtered.map((r, i) => [
      `AT-${new Date(r.created_at).toISOString().slice(0, 10).replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`,
      new Date(r.created_at).toLocaleString(),
      r.user_id ?? '',
      r.cohort,
      r.category,
      `"${r.summary.replace(/"/g, '""')}"`,
      r.escalation ? 'Yes' : '—',
    ]);
    const csv = [headers, ...csvRows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    const fromLabel = dateFrom || 'all';
    const toLabel   = dateTo   || 'all';
    a.download = `ai-audit-${fromLabel}-to-${toLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatId = (row: AuditRow, i: number) => {
    const d   = new Date(row.created_at);
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `AT-${ymd}-${String(i + 1).padStart(3, '0')}`;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-lg font-bold text-gray-800 tracking-tight leading-tight">
              {t('admin.audit.title')}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {t('admin.audit.subtitle')}
            </p>
          </div>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
        >
          <Download className="w-4 h-4" />
          {t('admin.audit.exportCsv')}
        </button>
      </div>

      {/* ── Filter Bar ── */}
      <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">

        {/* Text search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.audit.searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
          />
        </div>

        {/* Date From */}
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
          />
          <span className="text-xs text-gray-400">{t('admin.audit.to')}</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
          />
        </div>

        {/* Escalation-only toggle */}
        <button
          onClick={() => setEscalationOnly((v) => !v)}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-colors whitespace-nowrap ${
            escalationOnly
              ? 'bg-red-50 border-red-200 text-red-600'
              : 'bg-gray-50 border-gray-200 text-gray-500 hover:text-gray-700'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          {escalationOnly ? t('admin.audit.escalationsOnly') : t('admin.audit.allInteractions')}
        </button>

        {/* Clear filters */}
        {(dateFrom || dateTo || escalationOnly || search) && (
          <button
            onClick={() => {
              setDateFrom('');
              setDateTo('');
              setEscalationOnly(false);
              setSearch('');
            }}
            className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
          >
            {t('admin.audit.clearFilters')}
          </button>
        )}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
          {t('admin.audit.loadingAudit')}
        </div>
      ) : error ? (
        <div className="py-12 text-center text-red-500 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">
          {t('admin.audit.noInteractions')}
          {(dateFrom || dateTo || escalationOnly || search) && (
            <span className="block mt-1 text-xs text-gray-400">
              {t('admin.audit.adjustFilters')}
            </span>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {[t('admin.audit.columns.id'), t('admin.audit.columns.timestamp'), t('admin.audit.columns.userId'), t('admin.audit.columns.cohort'), t('admin.audit.columns.category'), t('admin.audit.columns.summary'), t('admin.audit.columns.escalation')].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left font-semibold text-gray-500 tracking-wider uppercase text-[10px]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((row, i) => (
                <tr 
                  key={row.message_id} 
                  className="hover:bg-blue-50/50 transition-colors cursor-pointer"
                  onClick={() => openConversation(row)}
                >
                  <td className="px-4 py-3 font-mono text-gray-500 whitespace-nowrap">
                    {formatId(row, i)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(row.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  {/* USER ID — for internal DB lookup only, shown truncated */}
                  <td className="px-4 py-3">
                    <span
                      className="font-mono text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded cursor-help"
                      title={row.user_id ?? 'N/A'}
                    >
                      {row.user_id ? `${row.user_id.slice(0, 8)}…` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {row.cohort}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">
                      {row.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-xs">
                    <span className="line-clamp-2">{row.summary}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.escalation ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {t('admin.audit.yes')}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Row count footer */}
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Showing {filtered.length} of up to {PAGE_SIZE} records
              {(dateFrom || dateTo) && ` · ${t('admin.audit.filteredByDate')}`}
              {escalationOnly && ` · ${t('admin.audit.escalationsOnly')}`}
            </p>
            <button
              onClick={fetchRows}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              {t('admin.metrics.refresh')}
            </button>
          </div>
        </div>
      )}

      {/* Conversation Dialog */}
      <Dialog
        open={!!selectedRow}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRow(null);
            setConversation([]);
            setRecentAccess([]);
            setReasonSubmitted(false);
            setReasonCode('quality_review');
            setReasonText('');
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                Conversation Details
              </DialogTitle>
            </div>
            {selectedRow && (
              <DialogDescription className="mt-2 space-y-1">
                <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
                  <span>ID: {selectedRow.message_id.slice(0, 8)}...</span>
                  <span>User: {selectedRow.user_id?.slice(0, 8)}...</span>
                  <span>Category: {selectedRow.category}</span>
                </div>
              </DialogDescription>
            )}
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
            {/* Compliance gate: must document reason before rendering PHI */}
            {!reasonSubmitted && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">Reason for access (required)</p>
                <p className="text-xs text-amber-800 mt-1">
                  Before viewing conversation content, document why you are accessing it. This will be saved to an append-only audit log.
                </p>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-amber-900 block mb-1">Reason code</label>
                    <select
                      value={reasonCode}
                      onChange={(e) => setReasonCode(e.target.value as any)}
                      className="w-full text-sm border border-amber-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="user_reported_issue">User reported issue</option>
                      <option value="quality_review">Quality review</option>
                      <option value="debugging">Debugging</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-amber-900 block mb-1">
                      Notes {reasonCode === 'other' ? '(required)' : '(optional)'}
                    </label>
                    <textarea
                      value={reasonText}
                      onChange={(e) => setReasonText(e.target.value)}
                      rows={3}
                      placeholder="Add context for why access is needed..."
                      className="w-full text-sm border border-amber-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="text-sm px-3 py-2 rounded-lg border border-amber-200 text-amber-900 hover:bg-amber-100"
                    onClick={() => setSelectedRow(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="text-sm px-3 py-2 rounded-lg bg-amber-700 text-white hover:bg-amber-800 disabled:opacity-50"
                    disabled={reasonCode === 'other' && !reasonText.trim()}
                    onClick={submitReasonAndLoadConversation}
                  >
                    View conversation
                  </button>
                </div>
              </div>
            )}

            {reasonSubmitted && recentAccess.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-700 mb-2">Recent access history</p>
                <div className="space-y-1">
                  {recentAccess.slice(0, 5).map((a: any) => (
                    <div key={a.id} className="text-[11px] text-gray-600 flex items-center justify-between gap-3">
                      <span className="truncate">
                        {a.accessor_role} • {a.reason_code}{a.reason_text ? ` — ${a.reason_text}` : ''}
                      </span>
                      <span className="flex-shrink-0 text-gray-400">
                        {new Date(a.accessed_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loadingConv ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                Loading full conversation...
              </div>
            ) : !reasonSubmitted ? (
              <div className="text-center py-10 text-gray-500 text-sm">
                Conversation content is locked until a reason is submitted.
              </div>
            ) : conversation.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">
                No messages found for this session.
              </div>
            ) : (
              conversation.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-4 h-4 text-blue-600" />
                    </div>
                  )}
                  <div 
                    className={`relative max-w-[80%] rounded-2xl px-5 py-3.5 text-sm ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-sm' 
                        : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                    } ${msg.is_flagged_for_review ? 'ring-2 ring-red-400 ring-offset-2' : ''}`}
                  >
                    {msg.is_flagged_for_review && (
                      <div className="absolute -top-2.5 -right-2.5 bg-red-100 text-red-600 p-1 rounded-full shadow-sm border border-red-200">
                        <AlertTriangle className="w-3 h-3" />
                      </div>
                    )}
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    <div className={`text-[10px] mt-2 text-right opacity-70 ${msg.role === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                      {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditTrailTable;
