import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Loader2, Pencil, Eye, EyeOff, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

interface DiscountCodesPanelProps {
  tenantId: string | null;
}

type DiscountType = 'percentage' | 'fixed';

interface DiscountCodeRow {
  id: string;
  code: string;
  discount_type: DiscountType;
  discount_amount: number;
  max_uses: number | null;
  current_uses: number | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean | null;
  created_at: string | null;
}

interface DiscountFormState {
  code: string;
  discount_type: DiscountType;
  discount_amount: string;
  max_uses: string;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
}

const EMPTY_FORM: DiscountFormState = {
  code: '',
  discount_type: 'percentage',
  discount_amount: '',
  max_uses: '',
  valid_from: '',
  valid_until: '',
  is_active: true,
};

const DiscountCodesPanel: React.FC<DiscountCodesPanelProps> = () => {
  const [rows, setRows] = useState<DiscountCodeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DiscountFormState>(EMPTY_FORM);

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRows((data ?? []) as DiscountCodeRow[]);
    } catch (err) {
      console.error('DiscountCodesPanel: fetch error', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to load discount codes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const beginEdit = (row: DiscountCodeRow) => {
    setEditingId(row.id);
    setForm({
      code: row.code,
      discount_type: row.discount_type,
      discount_amount: String(row.discount_amount ?? ''),
      max_uses: row.max_uses == null ? '' : String(row.max_uses),
      valid_from: row.valid_from ? row.valid_from.slice(0, 16) : '',
      valid_until: row.valid_until ? row.valid_until.slice(0, 16) : '',
      is_active: row.is_active ?? true,
    });
  };

  const summary = useMemo(() => {
    const active = rows.filter((r) => r.is_active).length;
    const expired = rows.filter((r) => r.valid_until && new Date(r.valid_until) < new Date()).length;
    return { total: rows.length, active, expired };
  }, [rows]);

  const handleSave = async () => {
    const normalizedCode = form.code.trim().toUpperCase();
    const amount = Number(form.discount_amount);
    const maxUses = form.max_uses.trim() ? Number(form.max_uses) : null;

    if (!normalizedCode) {
      toast({ title: 'Missing code', description: 'Please enter a promo code.', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: 'Invalid amount', description: 'Discount amount must be greater than 0.', variant: 'destructive' });
      return;
    }
    if (form.discount_type === 'percentage' && amount > 100) {
      toast({ title: 'Invalid percentage', description: 'Percentage discount cannot be more than 100.', variant: 'destructive' });
      return;
    }
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses <= 0)) {
      toast({ title: 'Invalid usage limit', description: 'Max uses must be a positive whole number.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: normalizedCode,
        discount_type: form.discount_type,
        discount_amount: amount,
        max_uses: maxUses,
        valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : null,
        valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
        is_active: form.is_active,
      };

      if (editingId) {
        const { error } = await supabase.from('discount_codes').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('discount_codes').insert(payload);
        if (error) throw error;
      }

      resetForm();
      fetchCodes();
      toast({ title: 'Saved', description: 'Discount code saved successfully.' });
    } catch (err) {
      console.error('DiscountCodesPanel: save error', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save discount code',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: DiscountCodeRow) => {
    try {
      const { error } = await supabase
        .from('discount_codes')
        .update({ is_active: !(row.is_active ?? false) })
        .eq('id', row.id);
      if (error) throw error;
      fetchCodes();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update discount code status',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this discount code? This cannot be undone.')) return;
    try {
      const { error } = await supabase.from('discount_codes').delete().eq('id', id);
      if (error) throw error;
      fetchCodes();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete discount code',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Discount & Promo Codes</h2>
        <p className="text-sm text-gray-500 mt-1">
          {summary.total} total · {summary.active} active · {summary.expired} expired
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="Code (e.g. MOM25)"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={form.discount_type}
            onChange={(e) => setForm({ ...form, discount_type: e.target.value as DiscountType })}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed ($)</option>
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.discount_amount}
            onChange={(e) => setForm({ ...form, discount_amount: e.target.value })}
            placeholder={form.discount_type === 'percentage' ? 'Percent off' : 'Amount off (USD)'}
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="number"
            min="1"
            value={form.max_uses}
            onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
            placeholder="Max uses (optional)"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            value={form.valid_from}
            onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            value={form.valid_until}
            onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />
          Active code
        </label>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {editingId ? 'Update Code' : 'Create Code'}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-14 text-center text-sm text-gray-500">No discount codes created yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((row) => (
              <div key={row.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{row.code}</p>
                  <p className="text-xs text-gray-500">
                    {row.discount_type === 'percentage' ? `${row.discount_amount}% off` : `$${row.discount_amount} off`}
                    {' · '}
                    Uses: {row.current_uses ?? 0}/{row.max_uses ?? 'unlimited'}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${row.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                  {row.is_active ? 'Active' : 'Inactive'}
                </span>
                <button onClick={() => beginEdit(row)} className="p-2 rounded hover:bg-gray-100" title="Edit">
                  <Pencil className="w-4 h-4 text-gray-500" />
                </button>
                <button onClick={() => toggleActive(row)} className="p-2 rounded hover:bg-gray-100" title="Toggle status">
                  {row.is_active ? <EyeOff className="w-4 h-4 text-gray-500" /> : <Eye className="w-4 h-4 text-gray-500" />}
                </button>
                <button onClick={() => handleDelete(row.id)} className="p-2 rounded hover:bg-red-50" title="Delete">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscountCodesPanel;
