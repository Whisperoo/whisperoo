import React, { useEffect, useState, useCallback } from 'react';
import { Eye, EyeOff, Loader2, PackageSearch, Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { TenantConfig } from '@/contexts/TenantContext';
import { useTranslation } from 'react-i18next';
import AdminProductForm from './AdminProductForm';
import { toast } from '@/hooks/use-toast';

interface ContentCurationPanelProps {
  tenantId: string | null;
}

interface Product {
  id: string;
  title: string;
  product_type: string;
  price: number;
  is_free: boolean;
  status: string;
  thumbnail_url: string | null;
  is_hospital_resource: boolean;
}

const ContentCurationPanel: React.FC<ContentCurationPanelProps> = ({ tenantId }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [disabledIds, setDisabledIds] = useState<string[]>([]);
  const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { t } = useTranslation();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: prods, error: prodError } = await supabase
        .from('products')
        .select('*')
        .order('title');
      if (prodError) throw prodError;
      setProducts((prods ?? []).map((p: any) => ({
        id: p.id,
        title: p.title || '',
        product_type: p.product_type || 'document',
        price: p.price || 0,
        is_free: p.is_free ?? (p.price === 0),
        status: p.status || 'published',
        thumbnail_url: p.thumbnail_url || null,
        is_hospital_resource: p.is_hospital_resource ?? false,
      })));

      if (tenantId) {
        const { data: tenantRow, error: tenantError } = await supabase
          .from('tenants')
          .select('config')
          .eq('id', tenantId)
          .single();
        if (tenantError) throw tenantError;
        const cfg = (tenantRow?.config as TenantConfig) ?? {};
        setTenantConfig(cfg);
        setDisabledIds(cfg.disabled_product_ids ?? []);
      } else {
        setDisabledIds([]);
        setTenantConfig(null);
      }
    } catch (err) {
      console.error('ContentCurationPanel: fetch error', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to load content',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggle = async (productId: string) => {
    if (!tenantId || !tenantConfig) return;
    setTogglingId(productId);

    const isCurrentlyDisabled = disabledIds.includes(productId);
    const newDisabledIds = isCurrentlyDisabled
      ? disabledIds.filter((id) => id !== productId)
      : [...disabledIds, productId];

    const updatedConfig: TenantConfig = {
      ...tenantConfig,
      disabled_product_ids: newDisabledIds,
    };

    try {
      const { error } = await supabase
        .from('tenants')
        .update({ config: updatedConfig })
        .eq('id', tenantId);
      if (error) throw error;
      setDisabledIds(newDisabledIds);
      setTenantConfig(updatedConfig);
    } catch (err) {
      console.error('ContentCurationPanel: toggle error', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update hospital visibility',
        variant: 'destructive',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product? This cannot be undone.')) return;
    setDeletingId(productId);
    try {
      const { error } = await supabase.from('products').delete().eq('id', productId);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: `Failed to delete: ${err.message}`, variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const typeColor: Record<string, string> = {
    video: 'bg-red-50 text-red-600',
    document: 'bg-blue-50 text-blue-600',
    audio: 'bg-purple-50 text-purple-600',
    course: 'bg-teal-50 text-teal-600',
    consultation: 'bg-green-50 text-green-600',
  };

  const statusColor: Record<string, string> = {
    published: 'bg-green-100 text-green-700',
    draft: 'bg-yellow-100 text-yellow-700',
    archived: 'bg-gray-100 text-gray-500',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  const enabledCount = products.filter(p => !disabledIds.includes(p.id)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t('admin.content.title')}</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage content and resources.{' '}
            <span className="font-medium text-gray-700">{products.length} items total</span>
            {tenantId && <> · <span className="font-medium text-emerald-600">{enabledCount} enabled</span></>}
          </p>
        </div>
        <button
          onClick={() => setEditingProduct('new')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Content
        </button>
      </div>

      <div className="bg-white rounded-[16px] border border-gray-200 shadow-sm overflow-hidden">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
            <PackageSearch className="w-10 h-10 opacity-30" />
            <p className="text-sm">{t('admin.content.noProducts')}</p>
            <button
              onClick={() => setEditingProduct('new')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Add your first resource →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {products.map((product) => {
              const isDisabled = disabledIds.includes(product.id);
              const isToggling = togglingId === product.id;
              const isDeleting = deletingId === product.id;

              return (
                <div
                  key={product.id}
                  className={`flex items-center gap-4 px-5 py-4 transition-colors ${
                    isDisabled ? 'bg-gray-50 opacity-70' : 'hover:bg-gray-50/50'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                    {product.thumbnail_url ? (
                      <img
                        src={product.thumbnail_url}
                        alt={product.title}
                        className="w-full h-full object-cover"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <PackageSearch className="w-5 h-5 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isDisabled ? 'text-gray-400' : 'text-gray-900'}`}>
                      {product.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${typeColor[product.product_type] ?? 'bg-gray-100 text-gray-500'}`}>
                        {product.product_type}
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${statusColor[product.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {product.status}
                      </span>
                      {product.is_hospital_resource && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">
                          Hospital
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {product.is_free ? t('admin.content.free') : `$${product.price}`}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Visibility toggle (only when tenant selected) */}
                    {tenantId && (
                      <button
                        onClick={() => handleToggle(product.id)}
                        disabled={isToggling}
                        title={isDisabled ? t('admin.content.enableForHospital') : t('admin.content.disableForHospital')}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all disabled:opacity-50 ${
                          isDisabled
                            ? 'border-gray-200 text-gray-400 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50'
                            : 'border-emerald-200 text-emerald-600 bg-emerald-50 hover:border-red-300 hover:text-red-500 hover:bg-red-50'
                        }`}
                      >
                        {isToggling ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isDisabled ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}

                    {/* Edit */}
                    <button
                      onClick={() => setEditingProduct(product.id)}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all"
                      title="Edit content"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(product.id)}
                      disabled={isDeleting}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
                      title="Delete content"
                    >
                      {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Product Form Modal */}
      {editingProduct && (
        <AdminProductForm
          productId={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={() => fetchData()}
        />
      )}
    </div>
  );
};

export default ContentCurationPanel;
