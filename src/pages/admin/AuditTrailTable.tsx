import React, { useEffect, useState, useCallback } from 'react';
import { Search, Download, RefreshCw, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AuditRow {
  message_id: string;
  created_at: string;
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
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [filtered, setFiltered] = useState<AuditRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    let query = supabase
      .from('admin_ai_audit_trail')
      .select('message_id, created_at, cohort, category, summary, escalation, tenant_id')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error: qErr } = await query;
    if (qErr) {
      setError(qErr.message);
    } else {
      setRows(data ?? []);
      setFiltered(data ?? []);
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Client-side search filter
  useEffect(() => {
    if (!search.trim()) {
      setFiltered(rows);
      return;
    }
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

  // CSV export
  const exportCsv = () => {
    const headers = ['ID', 'Timestamp', 'Cohort', 'Category', 'Summary', 'Escalation'];
    const csvRows = filtered.map((r, i) => [
      `AT-${new Date(r.created_at).toISOString().slice(0, 10).replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`,
      new Date(r.created_at).toLocaleString(),
      r.cohort,
      r.category,
      `"${r.summary.replace(/"/g, '""')}"`,
      r.escalation ? 'Yes' : '—',
    ]);
    const csv = [headers, ...csvRows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-audit-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Display ID formatter
  const formatId = (row: AuditRow, i: number) => {
    const d = new Date(row.created_at);
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `AT-${ymd}-${String(i + 1).padStart(3, '0')}`;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-lg font-bold text-gray-800 tracking-tight leading-tight">AI Interaction Audit Trail</h3>
            <p className="text-xs text-gray-500 mt-0.5">Complete, searchable log of all AI questions and responses</p>
          </div>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Search */}
      <div className="px-5 py-3 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by cohort, category, or interaction type..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
          Loading audit trail...
        </div>
      ) : error ? (
        <div className="py-12 text-center text-red-500 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">No interactions found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['ID', 'TIMESTAMP', 'COHORT', 'CATEGORY', 'SUMMARY', 'ESCALATION'].map((h) => (
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
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600">
                        Yes
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AuditTrailTable;
