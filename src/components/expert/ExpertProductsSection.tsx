import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Plus, 
  Edit, 
  Trash2, 
  FileText, 
  Video, 
  DollarSign,
  Eye,
  EyeOff 
} from 'lucide-react';
import { productService, ProductWithDetails } from '@/services/products';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { ProductUploadModal } from '@/components/products/ProductUploadModal';
import { ProductEditModal } from '@/components/products/ProductEditModal';
import { ProductCard } from '@/components/products/ProductCard';
import { ExpertProductCard } from '@/components/products/ExpertProductCard';
import { useTranslation } from 'react-i18next';

interface ExpertProductsSectionProps {
  expertId: string;
  expertName?: string;
  expertAvailabilityStatus?: string;
}

export const ExpertProductsSection: React.FC<ExpertProductsSectionProps> = ({
  expertId,
  expertName,
  expertAvailabilityStatus
}) => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isOwnProfile = profile?.id === expertId;
  
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithDetails | null>(null);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);

  // Fetch expert's products
  const { data: products, isLoading, error, refetch } = useQuery({
    queryKey: ['expert-products', expertId],
    queryFn: () => productService.getExpertProducts(expertId),
    enabled: !!expertId,
    retry: 2,
    retryDelay: 1000,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (productId: string) => productService.deleteProductPermanently(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expert-products', expertId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeleteProductId(null);
    },
    onError: (error) => {
      console.error('Delete failed:', error);
      alert('Failed to delete product. Please try again.');
    },
  });

  const handleEdit = (product: ProductWithDetails) => {
    setSelectedProduct(product);
    setShowEditModal(true);
  };

  const handleDelete = (productId: string) => {
    setDeleteProductId(productId);
  };

  const confirmDelete = () => {
    if (deleteProductId) {
      deleteMutation.mutate(deleteProductId);
    }
  };

  if (!isOwnProfile) {
    // Filter products for viewing - exclude consultation products if expert is unavailable
    const filteredProducts = products?.filter(product => {
      if (product.product_type === 'consultation' && expertAvailabilityStatus !== 'available') {
        return false;
      }
      return true;
    }) || [];

    // For viewing other experts' products, use the regular ProductGrid
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {expertName ? `${expertName}'s ${t('products.pageTitle').split(' ')[1]}` : t('products.pageTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-gray-200 aspect-[4/3] rounded-xl mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : !filteredProducts || filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('products.notFound') || 'No products available'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredProducts.map((product) => (
                <ExpertProductCard
                  key={product.id}
                  product={product}
                  onView={() => {
                    // Navigate to product detail page using React Router
                    navigate(`/products/${product.id}`);
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // For own profile, show management interface
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Your Products</CardTitle>
            <Button onClick={() => setShowUploadModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-8">
              <div className="text-red-600 mb-2">Failed to load products</div>
              <p className="text-sm text-muted-foreground mb-4">
                {error instanceof Error ? error.message : 'Please check your permissions and try again.'}
              </p>
              <Button variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <div className="text-center py-8">Loading products...</div>
          ) : products && products.length > 0 ? (
            <div className="grid gap-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="border border-gray-100 rounded-xl p-4 sm:p-5 hover:shadow-md transition-shadow bg-white"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border border-indigo-100/50">
                          {product.product_type === 'video' ? (
                            <Video className="h-6 w-6 text-indigo-600" />
                          ) : (
                            <FileText className="h-6 w-6 text-indigo-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-base sm:text-lg text-gray-900 leading-tight mb-1 break-words">
                            {product.title}
                          </h3>
                          {product.description && (
                            <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2 break-words">
                              {product.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            <Badge variant={product.product_type === 'video' ? 'secondary' : 'default'} className="text-[10px] sm:text-xs">
                              {product.product_type}
                            </Badge>
                            <Badge variant={product.is_active ? 'outline' : 'destructive'} className="text-[10px] sm:text-xs">
                              {product.is_active ? (
                                <>
                                  <Eye className="h-3 w-3 mr-1" />
                                  Active
                                </>
                              ) : (
                                <>
                                  <EyeOff className="h-3 w-3 mr-1" />
                                  Inactive
                                </>
                              )}
                            </Badge>
                            <div className="flex items-center text-[11px] sm:text-sm font-bold text-indigo-600">
                              <DollarSign className="h-3 w-3" />
                              {formatCurrency(product.price)}
                            </div>
                            {product.files && product.files.length > 0 ? (
                              <Badge variant="outline" className="text-green-600 text-[10px] sm:text-xs bg-green-50 border-green-100">
                                {product.files.length} file{product.files.length > 1 ? 's' : ''}
                              </Badge>
                            ) : product.file_url ? (
                              <Badge variant="outline" className="text-green-600 text-[10px] sm:text-xs bg-green-50 border-green-100">
                                1 file
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-yellow-600 text-[10px] sm:text-xs bg-yellow-50 border-yellow-100">
                                No files
                              </Badge>
                            )}
                          </div>
                          {product.categories && product.categories.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {product.categories.map((cat: any) => (
                                <Badge key={cat.category?.id || cat.id} variant="secondary" className="text-[10px] sm:text-xs bg-gray-50 text-gray-600 font-medium border-none">
                                  {cat.category?.name || cat.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:flex-col sm:gap-2 border-t sm:border-t-0 pt-3 sm:pt-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 sm:flex-none border-gray-200 hover:bg-gray-50 h-10 w-full sm:w-10 px-0"
                        onClick={() => handleEdit(product)}
                      >
                        <Edit className="h-4 w-4 text-gray-600" />
                        <span className="ml-2 sm:hidden font-bold">Edit</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 sm:flex-none border-red-100 hover:bg-red-50 h-10 w-full sm:w-10 px-0 text-red-600"
                        onClick={() => handleDelete(product.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="ml-2 sm:hidden font-bold">Delete</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No products yet</h3>
              <p className="text-muted-foreground mb-4">
                Start sharing your expertise by creating your first product
              </p>
              <Button onClick={() => setShowUploadModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Product
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <ProductUploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={() => {
          refetch();
          setShowUploadModal(false);
        }}
      />

      {/* Edit Modal */}
      {selectedProduct && (
        <ProductEditModal
          open={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedProduct(null);
          }}
          onSuccess={() => {
            refetch();
            setShowEditModal(false);
            setSelectedProduct(null);
          }}
          product={selectedProduct}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteProductId} onOpenChange={() => setDeleteProductId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this product. This action cannot be undone.
              Any customers who have purchased this product will still have access to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};