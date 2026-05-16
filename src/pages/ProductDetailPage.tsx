import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Star,
  Eye,
  Video,
  FileText,
  Clock,
  FileIcon,
  ArrowLeft,
  Heart,
  Share,
  Play,
  Users,
} from "lucide-react";
import {
  productService,
  ProductFile,
  getConsultationBookingModel,
  isConsultationBookingViaExpert,
} from "@/services/products";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { ContentViewer } from "@/components/content/ContentViewer";
import { ProductContentPreview } from "@/components/products/ProductContentPreview";
import { ProductPreviewModal } from "@/components/products/ProductPreviewModal";
import { toast } from "@/components/ui/sonner";
import { useTranslation } from "react-i18next";
export const ProductDetailPage: React.FC = () => {
  const { productId } = useParams<{
    productId: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [isPurchased, setIsPurchased] = useState(false);
  const [productFiles, setProductFiles] = useState<ProductFile[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [purchaseInfo, setPurchaseInfo] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isTogglingWishlist, setIsTogglingWishlist] = useState(false);
  const currentLang = i18n.language || 'en';
  const {
    data: product,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => (productId ? productService.getProduct(productId) : null),
    enabled: !!productId,
  });

  // Check if user has purchased this product and get purchase info
  useEffect(() => {
    if (user && productId) {
      const checkPurchase = async () => {
        const purchased = await productService.hasUserPurchased(
          user.id,
          productId,
        );
        setIsPurchased(purchased);
        if (purchased) {
          // Get the purchase details including amount paid
          const { data: purchase, error: purchaseError } = await supabase
            .from("purchases")
            .select("amount, currency, purchased_at")
            .eq("user_id", user.id)
            .eq("product_id", productId)
            .eq("status", "completed")
            .order("purchased_at", {
              ascending: false,
            })
            .limit(1)
            .maybeSingle();

          if (!purchaseError && purchase) {
            setPurchaseInfo(purchase);
          }
        }
      };
      checkPurchase();
    }
  }, [user, productId]);

  // Track view event
  useEffect(() => {
    if (productId) {
      productService.trackProductEvent(productId, "view", user?.id);
    }
  }, [productId, user]);

  // Check wishlist status
  useEffect(() => {
    if (user && productId) {
      const checkWishlist = async () => {
        const status = await productService.checkWishlistStatus(productId, user.id);
        setIsWishlisted(status);
      };
      checkWishlist();
    }
  }, [user, productId]);

  // Track view event
  useEffect(() => {
    if (productId && product) {
      productService.trackProductEvent(productId, "view", user?.id).catch(console.error);
    }
  }, [productId, product?.id, user?.id]);

  // Load product files if this is a multi-file product
  useEffect(() => {
    const loadProductFiles = async () => {
      if (
        product &&
        (product.has_multiple_files || product.total_files_count > 1)
      ) {
        try {
          const files = await productService.getProductFiles(product.id);
          setProductFiles(files);
        } catch (error) {
          console.error("Failed to load product files:", error);
        }
      }
    };
    loadProductFiles();
  }, [product]);

  // Reset processing state when returning to the page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setIsProcessing(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);
  const handlePurchase = () => {
    if (!user) {
      navigate("/auth/login");
      return;
    }
    // Navigate to purchase flow (to be implemented with Stripe)
    navigate(`/products/${productId}/purchase`);
  };

  const handleConsultationBookFromProduct = () => {
    if (!user) {
      navigate("/auth/login");
      return;
    }
    if (!product?.expert?.id) return;
    navigate(`/experts/${product.expert.id}`);
  };
  const handleSaveFreeContent = async () => {
    if (!user || !productId) {
      navigate("/auth/login");
      return;
    }
    try {
      // Save free content to user's purchases
      const { error } = await supabase.from("purchases").insert({
        user_id: user.id,
        product_id: productId,
        amount: 0,
        currency: "USD",
        status: "completed",
      });
      if (error) {
        console.error("Error saving free content:", error);
        toast.error("Failed to save content", {
          description:
            "There was an error saving the content. Please try again.",
          duration: 4000,
        });
        return;
      }

      // Update local state
      setIsPurchased(true);
      toast.success(t('products.saveSuccessTitle'), {
        description: t('products.saveSuccessDesc'),
        duration: 4000,
      });
    } catch (error) {
      console.error("Error saving free content:", error);
      toast.error(t('products.saveErrorTitle'), {
        description: t('products.saveErrorUnexpected'),
        duration: 4000,
      });
    }
  };
  const handleViewContent = () => {
    if (!user) {
      navigate("/auth/login");
      return;
    }

    if (isProcessing) return;

    // If purchased, show full content
    if (isPurchased) {
      productService.trackProductEvent(productId!, "download", user.id).catch(console.error);
      setShowPreview(true);
      return;
    }

    // If not purchased, show preview modal (no error messages)
    productService.trackProductEvent(productId!, "preview", user.id).catch(console.error);
    setShowPreviewModal(true);
  };

  const handleToggleWishlist = async () => {
    if (!user) {
      navigate("/auth/login");
      return;
    }

    if (isTogglingWishlist || !productId) return;

    setIsTogglingWishlist(true);
    try {
      const newState = await productService.toggleWishlist(productId, user.id);
      setIsWishlisted(newState);
      toast.success(newState ? "Added to Wishlist" : "Removed from Wishlist");
    } catch (error) {
      console.error("Error toggling wishlist:", error);
      toast.error("Failed to update wishlist");
    } finally {
      setIsTogglingWishlist(false);
    }
  };

  const handlePreviewClick = () => {
    if (!user) {
      navigate("/auth/login");
      return;
    }

    if (isProcessing) return;

    setShowPreviewModal(true);
  };
  const isFreeProduct = product?.price === 0;
  const consultationBookingModel = product ? getConsultationBookingModel(product) : "direct";
  const consultOpensExpertBooking =
    product && isConsultationBookingViaExpert(product);

  const getConsultationExpertNameAndTitle = () => {
    const e = product?.expert;
    if (!e) return "";
    const spec = e.expert_specialties?.[0];
    return spec ? `${e.first_name}, ${spec}` : e.first_name;
  };

  const consultationAboutBody =
    product?.product_type === "consultation"
      ? (() => {
          const e = product.expert;
          const descLocalized =
            currentLang === "es" && product.description_es
              ? product.description_es
              : currentLang === "vi" && product.description_vi
                ? product.description_vi
                : product.description || "";
          const descTrimmed = descLocalized.trim();

          if (consultationBookingModel === "inquiry") {
            const expertNameAndTitle = getConsultationExpertNameAndTitle();
            const firstName = e?.first_name ?? "";
            const prebook =
              e?.inquiry_prebook_message?.trim() ||
              (expertNameAndTitle
                ? `${t("experts.preBook.inquiryIntro", { expertNameAndTitle })}\n\n${t("experts.preBook.inquiryOutreach", { firstName })}`
                : descTrimmed);
            const confirmation = e?.inquiry_confirmation_message?.trim();
            return { variant: "inquiry" as const, prebook, confirmation, descTrimmed };
          }

          if (consultationBookingModel === "hospital") {
            const expertNameAndTitle = getConsultationExpertNameAndTitle();
            const firstName = e?.first_name ?? "";
            const hospPre =
              typeof product.hospital_prebook_message === "string"
                ? product.hospital_prebook_message.trim()
                : "";
            const prebook =
              hospPre ||
              (expertNameAndTitle
                ? `${t("experts.preBook.hospitalIntro", { expertNameAndTitle })}\n\n${t("experts.preBook.hospitalOutreach", { firstName })}`
                : descTrimmed);
            return { variant: "hospital" as const, prebook, descTrimmed };
          }

          return { variant: "direct" as const, descTrimmed };
        })()
      : null;

  // Course helpers
  const isCourse =
    productFiles.length > 1 &&
    productFiles.some(
      (file) =>
        file.file_type === "video" || file.mime_type?.startsWith("video/"),
    );
  const getTotalDuration = () => {
    if (!isCourse) return product?.duration_minutes;
    return productFiles.reduce(
      (total, file) => total + (file.duration_minutes || 0),
      0,
    );
  };
  const hasContent =
    product?.file_url || product?.primary_file_url || productFiles.length > 0;
  const formatFileSize = (mb: number | null) => {
    if (!mb) return "";
    if (mb < 1) return `${Math.round(mb * 1024)} KB`;
    return `${mb.toFixed(1)} MB`;
  };
  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };
  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">{t('products.loading')}</div>
        </div>
      </div>
    );
  }
  if (error || !product) {
    return (
      <div className="container mx-auto p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">{t('products.notFound')}</p>
              <Button onClick={() => navigate(-1)} className="mt-4">
                {t('products.back')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  // Non-paid consultations (inquiry / hospital) have their full booking flow
  // on the expert's profile page — redirect there to avoid the circular loop.
  if (
    product.product_type === 'consultation' &&
    isConsultationBookingViaExpert(product) &&
    product.expert?.id
  ) {
    navigate(`/experts/${product.expert.id}`, { replace: true });
    return null;
  }
  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('products.back')}
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product Image/Preview */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-0">
                <div className="relative aspect-video bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg overflow-hidden">
                  {product.thumbnail_url &&
                  product.thumbnail_url.trim() &&
                  !product.thumbnail_url.includes("placeholder") ? (
                    <div className="relative">
                      <img
                        src={product.thumbnail_url}
                        alt={currentLang === 'es' && product.title_es ? product.title_es : currentLang === 'vi' && product.title_vi ? product.title_vi : product.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          const fallback = e.currentTarget
                            .nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = "flex";
                        }}
                      />

                      {/* Fallback that shows when image fails to load */}
                      <div
                        className="absolute inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100"
                        style={{
                          display: "none",
                        }}
                      >
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg ${product.product_type === "video" ? "bg-gradient-to-br from-red-500 to-red-600" : product.product_type === "consultation" ? "bg-gradient-to-br from-green-500 to-green-600" : "bg-gradient-to-br from-blue-500 to-blue-600"}`}
                          >
                            {product.product_type === "video" ? (
                              <Play className="h-10 w-10 text-white ml-1" />
                            ) : product.product_type === "consultation" ? (
                              <Users className="h-10 w-10 text-white" />
                            ) : (
                              <FileText className="h-10 w-10 text-white" />
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-600 mt-3 capitalize">
                            {product.product_type}
                          </p>
                        </div>
                      </div>

                      {/* Play button overlay for videos */}
                      {(product.product_type === "video" || isCourse) &&
                        hasContent && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm hover:bg-black/30 transition-colors">
                            <Button
                              size="lg"
                              className="rounded-full h-16 w-16 bg-white/90 hover:bg-white text-gray-900 shadow-lg"
                              onClick={handleViewContent}
                            >
                              <Play className="h-6 w-6 ml-1" />
                            </Button>
                          </div>
                        )}
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg ${product.product_type === "video" ? "bg-gradient-to-br from-red-500 to-red-600" : product.product_type === "consultation" ? "bg-gradient-to-br from-green-500 to-green-600" : "bg-gradient-to-br from-blue-500 to-blue-600"}`}
                        >
                          {product.product_type === "video" ? (
                            <Play className="h-10 w-10 text-white ml-1" />
                          ) : product.product_type === "consultation" ? (
                            <Users className="h-10 w-10 text-white" />
                          ) : (
                            <FileText className="h-10 w-10 text-white" />
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-600 mt-3 capitalize">
                          {product.product_type}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Product Type Badge */}
                  <Badge className="absolute top-4 left-4 capitalize bg-white/90 text-gray-800 hover:bg-white">
                    {isCourse
                      ? "Course"
                      : product.product_type === "consultation"
                        ? "Consultation"
                        : product.product_type}
                  </Badge>

                  {/* Lessons Count for Courses */}
                  {isCourse && (
                    <Badge className="absolute top-4 right-4 bg-blue-600 hover:bg-blue-700">
                      {isCourse
                      ? t('products.lessons', { count: productFiles.length || product.total_files_count })
                      : ''}
                    </Badge>
                  )}

                  {/* Preview Button for non-video content */}
                  {/* {product.product_type !== "video" &&
                    !isCourse &&
                    hasContent && (
                      <div className="absolute bottom-4 right-4">
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-white/90 hover:bg-white backdrop-blur-sm"
                          onClick={handleViewContent}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </Button>
                      </div>
                    )} */}
                </div>
              </CardContent>
            </Card>

            {/* Product Description */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {isCourse ? t('products.aboutThisCourse') : t('products.aboutThisProduct')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {consultationAboutBody?.variant === "inquiry" ? (
                  <div className="space-y-4">
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {consultationAboutBody.prebook}
                    </p>
                    {consultationAboutBody.confirmation ? (
                      <div className="p-4 rounded-lg border border-indigo-200 bg-indigo-50/70">
                        <p className="text-xs font-semibold text-indigo-900 mb-1">
                          {t("products.noteFromExpert", {
                            name: product.expert?.first_name ?? t("products.expertFallbackName"),
                          })}
                        </p>
                        <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {consultationAboutBody.confirmation}
                        </p>
                      </div>
                    ) : null}
                    {consultationAboutBody.descTrimmed ? (
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {t("products.additionalDetails")}
                        </p>
                        <p className="text-muted-foreground leading-relaxed mt-1 whitespace-pre-wrap">
                          {consultationAboutBody.descTrimmed}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : consultationAboutBody?.variant === "hospital" ? (
                  <div className="space-y-4">
                    <Badge className="bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-100">
                      {t("experts.hospitalResourceTag")}
                    </Badge>
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {consultationAboutBody.prebook}
                    </p>
                    {consultationAboutBody.descTrimmed ? (
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {t("products.additionalDetails")}
                        </p>
                        <p className="text-muted-foreground leading-relaxed mt-1 whitespace-pre-wrap">
                          {consultationAboutBody.descTrimmed}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {currentLang === "es" && product.description_es
                      ? product.description_es
                      : currentLang === "vi" && product.description_vi
                        ? product.description_vi
                        : product.description}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Product Info Sidebar */}
          <div className="space-y-6">
            {/* Basic Info */}
            <Card>
              <CardContent className="p-6">
                <h1 className="text-2xl font-bold mb-4">
                  {currentLang === 'es' && product.title_es ? product.title_es : currentLang === 'vi' && product.title_vi ? product.title_vi : product.title}
                </h1>

                {/* Expert Info */}
                {product.expert && (
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar>
                      <AvatarImage
                        src={product.expert.profile_image_url || undefined}
                      />
                      <AvatarFallback>
                        {product.expert.first_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {product.expert.first_name}
                        {product.expert.expert_specialties?.[0]
                          ? `, ${product.expert.expert_specialties[0]}`
                          : ""}
                      </p>
                      {product.expert.tenant_id ? (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-brand-primary/10 text-brand-dark border border-brand-primary/20 text-xs font-semibold rounded">
                          {t('experts.hospitalExpertTag', 'Hospital Expert')}
                        </span>
                      ) : (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-brand-primary border border-brand-primary/10 text-xs font-semibold rounded">
                          {t('experts.whisperooExpertTag', 'Whisperoo Expert')}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {product.expert && (
                  <div className="mb-4 text-xs font-medium text-brand-primary">
                    {product.expert.tenant_id 
                      ? t('experts.hospitalDisclaimer', 'This expert is affiliated with a hospital partner.') 
                      : t('experts.whisperooDisclaimer', 'Whisperoo connects you with independent providers who are not employed by Whisperoo or endorsed by any hospital partner.')}
                  </div>
                )}

                {/* Rating */}
                {product.average_rating !== undefined &&
                  product.average_rating !== null && (
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">
                          {product.average_rating.toFixed(1)}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        ({product.total_reviews || 0} reviews)
                      </span>
                    </div>
                  )}

                {/* Categories */}
                {product.categories && product.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {product.categories.map((cat) => (
                      <Badge
                        key={(cat as any).category?.id || (cat as any).id}
                        variant="outline"
                      >
                        {(cat as any).category?.name || (cat as any).name}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Product Details */}

                {/* Price and Actions */}
                <div className="space-y-4">
                  {isPurchased && purchaseInfo ? (
                    <div className="space-y-2">
                      <div className="text-lg text-muted-foreground">
                        {t('products.youPaid')}
                      </div>
                      <div className="text-3xl font-bold">
                        {formatCurrency(purchaseInfo.amount)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {t('products.purchasedOn', { date: new Date(purchaseInfo.purchased_at).toLocaleDateString() })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-3xl font-bold">
                      {isCourse
                        ? ""
                        : isFreeProduct
                          ? t('products.free')
                          : formatCurrency(product.price)}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {isPurchased && product.product_type !== "consultation" ? (
                      <Button
                        onClick={handleViewContent}
                        className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                        size="lg"
                      >
                        <Eye className="h-4 w-4" />
                        {t('products.viewContent')}
                      </Button>
                    ) : consultOpensExpertBooking ? (
                      <Button
                        onClick={handleConsultationBookFromProduct}
                        className="flex-1 text-center leading-snug whitespace-normal min-h-[3rem] py-3 h-auto"
                        size="lg"
                      >
                        {t("products.requestAppointmentFreeConsultation")}
                      </Button>
                    ) : product.product_type === "consultation" && !isFreeProduct ? (
                      <Button
                        onClick={handlePurchase}
                        className="flex-1"
                        size="lg"
                      >
                        {t("products.bookConsultation")}
                      </Button>
                    ) : (
                      <Button
                        onClick={
                          isFreeProduct ? handleSaveFreeContent : handlePurchase
                        }
                        className="flex-1"
                        size="lg"
                      >
                        {isFreeProduct ? t('products.save') : t('products.purchaseNow')}
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="lg"
                      className="px-3 shrink-0"
                      onClick={handleToggleWishlist}
                      disabled={isTogglingWishlist}
                      title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                    >
                      <Heart className={`h-5 w-5 ${isWishlisted ? "fill-red-500 text-red-500" : "text-gray-500"}`} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* What You'll Get box removed as per requirements */}
          </div>
        </div>

        {/* Reviews are disabled in production - intentionally hidden */}

        {/* Content Viewer Modal (Full Access) */}
        {product && (
          <ContentViewer
            open={showPreview}
            onClose={() => {
              setShowPreview(false);
              setIsProcessing(false);
            }}
            product={product}
          />
        )}

        {/* Product Preview Modal (Limited Access) */}
        {product && (
          <ProductPreviewModal
            open={showPreviewModal}
            onClose={() => {
              setShowPreviewModal(false);
              setIsProcessing(false);
            }}
            product={product}
            productFiles={productFiles}
            onPurchase={handlePurchase}
            isPurchased={isPurchased}
          />
        )}
      </div>
    </div>
  );
};
