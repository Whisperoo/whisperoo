import React, { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Download, FileText, Video, ArrowRight, Star, Gift } from 'lucide-react';
import { productService } from '@/services/products';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import confetti from 'canvas-confetti';
export const PurchaseSuccessPage: React.FC = () => {
  const {
    productId
  } = useParams<{
    productId: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user
  } = useAuth();

  // Get purchase ID from URL state if available
  const purchaseId = location.state?.purchaseId;
  const {
    data: product,
    isLoading
  } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => productId ? productService.getProduct(productId) : null,
    enabled: !!productId
  });

  // Fire confetti on successful purchase
  useEffect(() => {
    if (product) {
      const fireConfetti = () => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
        });
        
        // Fire additional confetti bursts
        setTimeout(() => {
          confetti({
            particleCount: 50,
            spread: 50,
            origin: { x: 0.2, y: 0.7 }
          });
        }, 200);
        
        setTimeout(() => {
          confetti({
            particleCount: 50,
            spread: 50,
            origin: { x: 0.8, y: 0.7 }
          });
        }, 400);
      };

      // Delay confetti slightly to let page render
      const timeout = setTimeout(fireConfetti, 300);
      return () => clearTimeout(timeout);
    }
  }, [product]);

  // Redirect if no user or product
  useEffect(() => {
    if (!user) {
      navigate('/auth/login');
      return;
    }
    if (!productId) {
      navigate('/products');
      return;
    }
  }, [user, productId, navigate]);
  if (isLoading || !product) {
    return <div className="container mx-auto p-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="animate-pulse">Loading...</div>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-gray-50 container mx-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Success Header */}
        <div className="text-center py-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {product.product_type === 'consultation' ? 'Consultation Booked! 🎉' : 'Purchase Successful! 🎉'}
          </h1>
          <p className="text-lg text-gray-600">
            {product.product_type === 'consultation' 
              ? 'Your consultation has been booked successfully. The expert will reach out to you within 24 hours to schedule your appointment.'
              : 'Thank you for your purchase. You now have access to your new resource.'
            }
          </p>
        </div>

        {/* Product Details */}
        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardTitle className="flex items-center gap-3">
              <Gift className="h-6 w-6 text-blue-600" />
              What You Just Purchased
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex gap-4">
              {/* Product Thumbnail */}
              <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                {product.product_type === 'video' ? <Video className="h-10 w-10 text-blue-600" /> : <FileText className="h-10 w-10 text-blue-600" />}
              </div>

              {/* Product Info */}
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {product.title}
                </h3>
                
                {product.description && <p className="text-gray-600 mb-3 line-clamp-2">
                    {product.description}
                  </p>}

                <div className="flex items-center gap-3 mb-3">
                  <Badge className="capitalize">
                    {product.product_type}
                  </Badge>
                  
                  {product.expert && <span className="text-sm text-gray-500">
                      by {product.expert.first_name}
                    </span>}
                </div>

                {/* Product Details */}
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  {product.file_size_mb && <span>
                      {product.file_size_mb < 1 ? `${Math.round(product.file_size_mb * 1024)} KB` : `${product.file_size_mb.toFixed(1)} MB`}
                    </span>}
                  
                  {product.product_type === 'document' && product.page_count && <span>{product.page_count} pages</span>}
                  
                  {product.product_type === 'video' && product.duration_minutes && <span>
                      {Math.floor(product.duration_minutes / 60) > 0 ? `${Math.floor(product.duration_minutes / 60)}h ${product.duration_minutes % 60}m` : `${product.duration_minutes}m`}
                    </span>}
                </div>
              </div>

              {/* Price */}
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(product.price)}
                </div>
                <div className="text-sm text-gray-500">
                  One-time purchase
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What's Next */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Star className="h-5 w-5 text-yellow-500" />
              What's Next?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {product.product_type === 'consultation' ? (
                <>
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-sm">1</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Expert Will Contact You</p>
                      <p className="text-sm text-gray-600">
                        {product.expert?.first_name || 'The expert'} will reach out to you within 24 hours to schedule your appointment
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 font-semibold text-sm">2</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Prepare for Your Session</p>
                      <p className="text-sm text-gray-600">
                        Think about your questions and goals for the consultation
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-purple-600 font-semibold text-sm">3</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Get Support</p>
                      <p className="text-sm text-gray-600">
                        Have questions about your booking? Our support team is here to help
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-sm">1</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Access Your Purchase</p>
                      <p className="text-sm text-gray-600">
                        Your product is now available in your purchases section
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 font-semibold text-sm">2</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">View & Enjoy</p>
                      <p className="text-sm text-gray-600">Access and download your content in your "My Content" tab anytime, anywhere</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-purple-600 font-semibold text-sm">3</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Get Support</p>
                      <p className="text-sm text-gray-600">
                        Have questions? Our 24/7 chat support is here to help
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            onClick={() => navigate(product.product_type === 'consultation' ? '/my-purchases?tab=bookings' : '/my-purchases')} 
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2 h-12" 
            size="lg"
          >
            <Download className="h-5 w-5" />
            {product.product_type === 'consultation' ? 'View My Bookings' : 'View My Purchases'}
          </Button>
          
          <Button variant="outline" onClick={() => navigate(product.product_type === 'consultation' ? '/experts' : '/products')} className="flex-1 gap-2 h-12" size="lg">
            {product.product_type === 'consultation' ? 'Browse More Experts' : 'Continue Shopping'}
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Footer Message */}
        <div className="text-center py-6">
          <p className="text-gray-600">
            {product.product_type === 'consultation' 
              ? 'Thank you for booking with our expert! We look forward to helping you. 💙'
              : 'Thank you for supporting our expert community! 💙'
            }
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Questions? Contact us through our{' '}
            <button onClick={() => navigate('/chat')} className="text-blue-600 hover:underline">
              24/7 support chat
            </button>
          </p>
        </div>
      </div>
    </div>;
};