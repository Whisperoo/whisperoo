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
import { productService, ProductFile } from "@/services/products";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { ContentViewer } from "@/components/content/ContentViewer";
import { ProductContentPreview } from "@/components/products/ProductContentPreview";
import { ProductPreviewModal } from "@/components/products/ProductPreviewModal";
import { toast } from "@/components/ui/sonner";
export const ProductDetailPage: React.FC = () => {
  const { productId } = useParams<{
    productId: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isPurchased, setIsPurchased] = useState(false);
  const [productFiles, setProductFiles] = useState<ProductFile[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [purchaseInfo, setPurchaseInfo] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
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
      toast.success("Content saved successfully!", {
        description: "Free content has been added to your library.",
        duration: 4000,
      });
    } catch (error) {
      console.error("Error saving free content:", error);
      toast.error("Failed to save content", {
        description: "An unexpected error occurred. Please try again.",
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
      setShowPreview(true);
      return;
    }

    // If not purchased, show preview modal (no error messages)
    setShowPreviewModal(true);
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
          <div className="text-center">Loading...</div>
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
              <p className="text-muted-foreground">Product not found</p>
              <Button onClick={() => navigate(-1)} className="mt-4">
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
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
                        alt={product.title}
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
                      {productFiles.length || product.total_files_count} lessons
                    </Badge>
                  )}

                  {/* Preview Button for non-video content */}
                  {product.product_type !== "video" &&
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
                    )}
                </div>
              </CardContent>
            </Card>

            {/* Product Description */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {isCourse ? "About This Course" : "About This Product"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  {product.description}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Product Info Sidebar */}
          <div className="space-y-6">
            {/* Basic Info */}
            <Card>
              <CardContent className="p-6">
                <h1 className="text-2xl font-bold mb-4">{product.title}</h1>

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
                      <p className="font-medium">{product.expert.first_name}</p>
                      <p className="text-sm text-muted-foreground">Expert</p>
                    </div>
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
                        You paid
                      </div>
                      <div className="text-3xl font-bold">
                        {formatCurrency(purchaseInfo.amount)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Purchased on{" "}
                        {new Date(
                          purchaseInfo.purchased_at,
                        ).toLocaleDateString()}
                      </div>
                    </div>
                  ) : (
                    <div className="text-3xl font-bold">
                      {isCourse
                        ? ""
                        : isFreeProduct
                          ? "Free"
                          : formatCurrency(product.price)}
                    </div>
                  )}

                  {isPurchased && product.product_type !== "consultation" ? (
                    <Button
                      onClick={handleViewContent}
                      className="w-full gap-2 bg-green-600 hover:bg-green-700"
                      size="lg"
                    >
                      <Eye className="h-4 w-4" />
                      View Content
                    </Button>
                  ) : (
                    <Button
                      onClick={
                        isFreeProduct ? handleSaveFreeContent : handlePurchase
                      }
                      className="w-full"
                      size="lg"
                    >
                      {isFreeProduct ? "Save" : "Purchase Now"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Additional Info */}
            {product.product_type !== "consultation" && (
              <Card>
                <CardHeader>
                  <CardTitle>What You'll Get</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full" />
                      <span>Instant content access</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full" />
                      <span>Lifetime access</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full" />
                      <span>Expert-created content</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full" />
                      <span>Mobile-friendly format</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

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
