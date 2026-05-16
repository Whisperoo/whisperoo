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
import { useTranslation } from 'react-i18next';
export const PurchaseSuccessPage: React.FC = () => {
  const {
    productId
  } = useParams<{
    productId: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();

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
          <div className="animate-pulse">{t('purchaseSuccess.loading')}</div>
        </div>
      </div>;
  }

  const bookingModel = (product as any).booking_model as string | null | undefined;
  const isConsultation = product.product_type === 'consultation';
  const isDirectBooking = isConsultation && bookingModel === 'direct';
  const isHospitalBooking = isConsultation && bookingModel === 'hospital';
  const isInquiryBooking = isConsultation && !isDirectBooking && !isHospitalBooking;
  const expertName = product.expert?.first_name || 'The expert';

  // Per-product overrides set by super admin (booking_confirmation_title / _desc).
  const customTitle = ((product as any).booking_confirmation_title as string | null | undefined)?.trim();
  const customDesc  = ((product as any).booking_confirmation_desc  as string | null | undefined)?.trim();

  let headerTitle: string;
  let headerDesc: string;
  if (customTitle) {
    headerTitle = customTitle;
    headerDesc  = customDesc || (isConsultation ? t('purchaseSuccess.consultationDesc') : t('purchaseSuccess.purchaseDesc'));
  } else if (isDirectBooking) {
    headerTitle = t('purchaseSuccess.directBookingTitle');
    headerDesc = t('purchaseSuccess.directBookingDesc', { expertName });
  } else if (isHospitalBooking) {
    headerTitle = t('purchaseSuccess.consultationTitle');
    headerDesc = t('purchaseSuccess.hospitalBookingDesc');
  } else if (isInquiryBooking) {
    headerTitle = t('purchaseSuccess.consultationTitle');
    headerDesc = t('purchaseSuccess.consultationDesc');
  } else {
    headerTitle = t('purchaseSuccess.purchaseTitle');
    headerDesc = t('purchaseSuccess.purchaseDesc');
  }

  return <div className="min-h-screen bg-gray-50 container mx-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Success Header */}
        <div className="text-center py-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {headerTitle}
          </h1>
          <p className="text-lg text-gray-600">
            {headerDesc}
          </p>
        </div>

        {/* Product Details */}
        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardTitle className="flex items-center gap-3">
              <Gift className="h-6 w-6 text-blue-600" />
              {t('purchaseSuccess.whatYouPurchased')}
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
                      {t('purchaseSuccess.by', { name: product.expert.first_name })}
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
              {t('purchaseSuccess.whatsNext')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {product.product_type === 'consultation' ? (
                <>
                  {/* Custom scheduling instructions from expert/admin */}
                  {product.how_to_schedule ? (
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-blue-600 font-semibold text-sm">📋</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 mb-2">How to Schedule</p>
                          <p className="text-sm text-blue-900 whitespace-pre-wrap leading-relaxed">
                            {product.how_to_schedule}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <span className="text-purple-600 font-semibold text-sm">💬</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Get Support</p>
                          <p className="text-sm text-gray-600">
                            Have questions? Our support team is here to help
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    (() => {
                      const stepsKey = isDirectBooking
                        ? 'directBooking'
                        : isHospitalBooking
                          ? 'hospitalBooking'
                          : 'consultation';
                      const defaultStep1Desc = t(`purchaseSuccess.${stepsKey}.step1Desc`, { expertName });
                      const step1DefaultDesc = isInquiryBooking
                        ? (product.expert as any)?.inquiry_confirmation_message?.trim() || defaultStep1Desc
                        : isDirectBooking
                          ? (product.expert as any)?.inquiry_prebook_message?.trim() || defaultStep1Desc
                          : defaultStep1Desc;
                      return (
                        <>
                          {/* Default steps when no custom instructions */}
                          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 font-semibold text-sm">1</span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {t(`purchaseSuccess.${stepsKey}.step1Title`)}
                              </p>
                              <p className="text-sm text-gray-600">
                                {(isInquiryBooking || isDirectBooking) ? step1DefaultDesc : defaultStep1Desc}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                              <span className="text-green-600 font-semibold text-sm">2</span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {t(`purchaseSuccess.${stepsKey}.step2Title`)}
                              </p>
                              <p className="text-sm text-gray-600">
                                {t(`purchaseSuccess.${stepsKey}.step2Desc`)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                              <span className="text-purple-600 font-semibold text-sm">3</span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {t(`purchaseSuccess.${stepsKey}.step3Title`)}
                              </p>
                              <p className="text-sm text-gray-600">
                                {t(`purchaseSuccess.${stepsKey}.step3Desc`)}
                              </p>
                            </div>
                          </div>
                        </>
                      );
                    })()
                  )}
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
            onClick={() => navigate(product.product_type === 'consultation' ? '/my-purchases?tab=appointments' : '/my-purchases')}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2 h-12"
            size="lg"
          >
            <Download className="h-5 w-5" />
            {product.product_type === 'consultation' ? t('purchaseSuccess.viewAppointments') : t('purchaseSuccess.viewPurchases')}
          </Button>

          <Button variant="outline" onClick={() => navigate(product.product_type === 'consultation' ? '/experts' : '/products')} className="flex-1 gap-2 h-12" size="lg">
            {product.product_type === 'consultation' ? t('purchaseSuccess.browseMoreExperts') : t('purchaseSuccess.continueShopping')}
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Footer Message */}
        <div className="text-center py-6">
          <p className="text-gray-600">
            {product.product_type === 'consultation'
              ? t('purchaseSuccess.thankYouConsultation')
              : t('purchaseSuccess.thankYouPurchase')
            }
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {t('purchaseSuccess.questionsPrompt')}{' '}
            <button onClick={() => navigate('/chat')} className="text-blue-600 hover:underline">
              {t('purchaseSuccess.supportChat')}
            </button>
          </p>
        </div>
      </div>
    </div>;
};