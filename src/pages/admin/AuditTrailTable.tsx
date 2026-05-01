import React, { useEffect, useState, useCallback } from 'react';
import { Search, Download, RefreshCw, Shield, AlertTriangle, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
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
  const { t } = useTranslation();

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
                <tr key={row.message_id} className="hover:bg-gray-50/50 transition-colors">
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
    </div>
  );
};

export default AuditTrailTable;
