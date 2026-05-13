import React, { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Search, RefreshCw, Download } from "lucide-react";

type ReasonCode = "user_reported_issue" | "quality_review" | "debugging" | "other";

interface PhiAccessRow {
  id: string;
  accessed_at: string;
  accessor_user_id: string;
  accessor_role: string;
  patient_user_id: string;
  resource_type: string;
  resource_id: string;
  action: string;
  reason_code: ReasonCode;
  reason_text: string | null;
}

const PhiAccessLogPanel: React.FC = () => {
  const [rows, setRows] = useState<PhiAccessRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [patientFilter, setPatientFilter] = useState("");
  const [accessorFilter, setAccessorFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  const fetchRows = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin_phi_access_log", {
        body: {
          patient_user_id: patientFilter.trim() || undefined,
          accessor_user_id: accessorFilter.trim() || undefined,
          date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
          date_to: dateTo
            ? new Date(new Date(dateTo).setHours(23, 59, 59, 999)).toISOString()
            : undefined,
          limit: 500,
        },
      });
      if (error) throw error;
      setRows((data?.rows || []) as PhiAccessRow[]);
    } catch (e) {
      console.error("Failed to load PHI access logs:", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  /** HIPAA C5: Export uses current filters and up to 10k rows from the edge function (not UI-limited page). */
  const exportCsv = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin_phi_access_log", {
        body: {
          patient_user_id: patientFilter.trim() || undefined,
          accessor_user_id: accessorFilter.trim() || undefined,
          date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
          date_to: dateTo
            ? new Date(new Date(dateTo).setHours(23, 59, 59, 999)).toISOString()
            : undefined,
          limit: 10000,
        },
      });
      if (error) throw error;
      const exportRows = ((data?.rows || []) as PhiAccessRow[]).filter((r) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        const hay = [
          r.accessor_user_id,
          r.patient_user_id,
          r.accessor_role,
          r.resource_type,
          r.resource_id,
          r.action,
          r.reason_code,
          r.reason_text || "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
      if (exportRows.length === 0) return;

      const headers = [
        "accessed_at",
        "accessor_user_id",
        "accessor_role",
        "patient_user_id",
        "resource_type",
        "resource_id",
        "action",
        "reason_code",
        "reason_text",
      ];
      const escapeCell = (val: string | null | undefined) =>
        `"${String(val ?? "").replace(/"/g, '""')}"`;
      const csvRows = exportRows.map((r) => [
        escapeCell(new Date(r.accessed_at).toISOString()),
        escapeCell(r.accessor_user_id),
        escapeCell(r.accessor_role),
        escapeCell(r.patient_user_id),
        escapeCell(r.resource_type),
        escapeCell(r.resource_id),
        escapeCell(r.action),
        escapeCell(r.reason_code),
        escapeCell(r.reason_text),
      ]);
      const csv = [headers.join(","), ...csvRows.map((row) => row.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      const patientSuffix = patientFilter.trim()
        ? `-patient-${patientFilter.trim().slice(0, 8)}`
        : "";
      a.download = `phi-access-log-${stamp}${patientSuffix}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("PHI access log export failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        r.accessor_user_id,
        r.patient_user_id,
        r.accessor_role,
        r.resource_type,
        r.resource_id,
        r.action,
        r.reason_code,
        r.reason_text || "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900">PHI Access Log</h3>
          <p className="text-xs text-gray-500">
            Append-only record of admin accesses to conversation content.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void exportCsv()}
            disabled={loading}
            title="Export access history as CSV (HIPAA accounting of disclosures)"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={fetchRows}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="px-5 py-3 border-b border-gray-100 grid grid-cols-1 lg:grid-cols-5 gap-3">
        <input
          value={patientFilter}
          onChange={(e) => setPatientFilter(e.target.value)}
          placeholder="Filter by patient user_id"
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          value={accessorFilter}
          onChange={(e) => setAccessorFilter(e.target.value)}
          placeholder="Filter by accessor user_id"
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs"
            className="w-full text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {[
                "Time",
                "Accessor",
                "Role",
                "Patient",
                "Resource",
                "Action",
                "Reason",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider text-[10px]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50/70">
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {new Date(r.accessed_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-mono text-[10px] text-gray-700">
                  {r.accessor_user_id}
                </td>
                <td className="px-4 py-3 text-gray-700">{r.accessor_role}</td>
                <td className="px-4 py-3 font-mono text-[10px] text-gray-700">
                  {r.patient_user_id}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  <span className="font-mono text-[10px]">
                    {r.resource_type}:{r.resource_id}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">{r.action}</td>
                <td className="px-4 py-3 text-gray-700">
                  <span className="font-semibold">{r.reason_code}</span>
                  {r.reason_text ? (
                    <span className="text-gray-500"> — {r.reason_text}</span>
                  ) : null}
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  No logs found. Click Refresh to load.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PhiAccessLogPanel;

