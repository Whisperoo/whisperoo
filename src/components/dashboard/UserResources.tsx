import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Video, FileText, AlertCircle, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { productService } from '@/services/products';
import { formatCurrency } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export const UserResources: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: purchases, isLoading, error } = useQuery({
    queryKey: ['user-purchases', user?.id],
    queryFn: () => user ? productService.getUserPurchases(user.id) : [],
    enabled: !!user,
  });

  const handleResourceClick = (purchase: any) => {
    // Navigate to the product detail page
    navigate(`/products/${purchase.product_id}`);
  };

  const handleViewAllClick = () => {
    navigate('/my-purchases');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-card p-6 mb-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-brand-primary">Your Resources</h2>
          <div className="w-5 h-5 animate-pulse bg-gray-200 rounded"></div>
        </div>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-4 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-gray-200 rounded-lg flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/3 mb-3"></div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                    <div className="h-3 bg-gray-200 rounded w-24"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-card p-6 mb-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-brand-primary">Your Resources</h2>
          <ArrowRight className="w-5 h-5 text-brand-primary" />
        </div>
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Unable to load your resources</p>
          <button
            onClick={() => window.location.reload()}
            className="text-brand-primary hover:text-brand-dark font-medium transition-colors duration-200"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Empty state - no purchases
  if (!purchases || purchases.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-card p-6 mb-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-brand-primary">Your Resources</h2>
          <ArrowRight 
            className="w-5 h-5 text-brand-primary cursor-pointer hover:text-brand-dark transition-colors duration-200" 
            onClick={() => navigate('/products')}
          />
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gradient-to-br from-brand-light to-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-8 h-8 text-brand-primary" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Resources Yet</h3>
          <p className="text-gray-600 mb-6 max-w-sm mx-auto">
            Start building your parenting resource library with expert-created content tailored to your family's needs.
          </p>
          <button
            onClick={() => navigate('/products')}
            className="bg-brand-primary hover:bg-brand-dark text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
          >
            Browse Expert Resources
          </button>
        </div>
      </div>
    );
  }

  // Show purchased resources (limit to most recent 3)
  const displayPurchases = purchases.slice(0, 3);

  return (
    <div className="bg-white rounded-xl shadow-card p-6 mb-6 border border-gray-200 hover:shadow-elevated transition-shadow duration-300">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-brand-primary">Your Resources</h2>
        <button
          onClick={handleViewAllClick}
          className="flex items-center gap-2 text-brand-primary hover:text-brand-dark transition-colors duration-200 font-medium"
        >
          <span className="text-sm">View All</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        {displayPurchases.map((purchase: any, index: number) => (
          <div 
            key={purchase.id}
            className="group bg-gray-50 hover:bg-white border border-gray-100 hover:border-brand-primary hover:shadow-card rounded-lg p-4 cursor-pointer transition-all duration-300 transform hover:scale-[1.01]"
            onClick={() => handleResourceClick(purchase)}
          >
            {/* Header with title and type badge */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`p-2 rounded-lg flex-shrink-0 ${
                  purchase.product?.product_type === 'video'
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-action-primary text-white'
                }`}>
                  {purchase.product?.product_type === 'video' ? (
                    <Video className="w-4 h-4" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 group-hover:text-brand-primary transition-colors duration-200 text-base leading-tight mb-1 truncate">
                    {purchase.product?.title || 'Resource'}
                  </h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    purchase.product?.product_type === 'video'
                      ? 'text-blue-700 bg-blue-100'
                      : 'text-white bg-action-primary'
                  }`}>
                    {purchase.product?.product_type === 'video' ? 'Video Content' : 'PDF Guide'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Description */}
            {purchase.product?.description && 
             purchase.product.description.trim() && 
             purchase.product.description !== 'testtestesese' && (
              <p className="text-gray-600 text-sm mb-4 line-clamp-2 leading-relaxed">
                {purchase.product.description}
              </p>
            )}
            
            {/* Expert info and purchase details */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="w-10 h-10 ring-2 ring-white">
                    <AvatarImage 
                      src={purchase.product?.expert?.profile_image_url || undefined}
                      alt={purchase.product?.expert?.first_name || 'Expert'}
                    />
                    <AvatarFallback className="bg-gradient-to-br from-brand-primary to-blue-600 text-white text-sm font-bold">
                      {purchase.product?.expert?.first_name?.[0] || 'E'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {purchase.product?.expert?.first_name || 'Expert'}
                  </p>
                  <p className="text-xs text-gray-500 font-medium">
                    Verified Expert
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-0.5">
                  {formatDate(purchase.purchased_at)}
                </p>
                <p className="text-sm font-bold text-green-600">
                  {formatCurrency(purchase.amount)}
                </p>
              </div>
            </div>
          </div>
        ))}
        
        {/* Show enhanced "View All" link if there are more purchases */}
        {purchases.length > 3 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={handleViewAllClick}
              className="w-full bg-gray-50 hover:bg-brand-light border border-gray-200 hover:border-brand-primary text-brand-primary hover:text-brand-dark font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span>View all {purchases.length} resources</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};