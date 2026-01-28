import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Star,
  Video,
  FileText,
  Clock,
  FileIcon,
  File,
  Play,
  Eye,
} from "lucide-react";
import {
  ProductWithDetails,
  ProductFile,
  productService,
} from "@/services/products";
import { formatCurrency } from "@/lib/utils";
import { PurchaseModal } from "./PurchaseModal";
import { ContentViewer } from "@/components/content/ContentViewer";
import { ProductPreviewModal } from "./ProductPreviewModal";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface ProductCardProps {
  product: ProductWithDetails;
  onView?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onView,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isPurchased, setIsPurchased] = useState(false);
  const [isCheckingPurchase, setIsCheckingPurchase] = useState(false);
  const [productFiles, setProductFiles] = useState<ProductFile[]>([]);

  const isFreeProduct = product.price === 0;
  const hasContent = !!(product.primary_file_url || product.file_url);

  // Course detection logic - improved to detect multi-file products as courses
  // productFiles.length > 1 ||
  // (product.has_multiple_files &&
  //   product.total_files_count &&
  //   product.total_files_count > 1) ||
  // (product.content_type &&
  //   ["bundle", "course", "collection", "video"].includes(
  //     product.content_type,
  //   ));

  // Check if user has already saved this free content
  React.useEffect(() => {
    if (user && isFreeProduct) {
      checkSaveStatus();
    }
  }, [user, product.id, isFreeProduct]);

  // Check if user has purchased this paid product
  React.useEffect(() => {
    if (user && !isFreeProduct) {
      checkPurchaseStatus();
    }
  }, [user, product.id, isFreeProduct]);

  // Load product files if this is a multi-file product
  React.useEffect(() => {
    const loadProductFiles = async () => {
      if (
        product.has_multiple_files ||
        (product.total_files_count && product.total_files_count > 1)
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
  }, [product.id, product.has_multiple_files, product.total_files_count]);
  useEffect(() => {
    const loadProductFiles = async () => {
      try {
        const files = await productService.getProductFiles(product.id);
        setProductFiles(files ?? []);
      } catch (err) {
        console.error("Failed to load product files", err);
      }
    };

    loadProductFiles();
  }, [product.id]);
  useEffect(() => {
    console.log({
      productId: product.id,
      productFilesLength: productFiles.length,
      totalFilesCount: product.total_files_count,
      lessonCount,
    });
  }, [productFiles, product.total_files_count]);

  const checkSaveStatus = async () => {
    if (!user) return;

    setIsCheckingStatus(true);
    try {
      const { data, error } = await supabase
        .from("purchases")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", product.id)
        .limit(1);

      if (error) {
        console.error("Error checking save status:", error);
        return;
      }

      setIsSaved(data && data?.length > 0);
    } catch (error) {
      console.error("Error checking save status:", error);
    } finally {
      setIsCheckingStatus(false);
    }
  };
  useEffect(() => {
    console.table(productFiles);
  }, [productFiles]);

  const checkPurchaseStatus = async () => {
    if (!user) return;

    setIsCheckingPurchase(true);
    try {
      const purchased = await productService.hasUserPurchased(
        user.id,
        product.id,
      );
      setIsPurchased(purchased);
    } catch (error) {
      console.error("Error checking purchase status:", error);
    } finally {
      setIsCheckingPurchase(false);
    }
  };

  const handleSaveFreeContent = async () => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to save content to your library.",
        variant: "destructive",
      });
      return;
    }

    if (isSaved) {
      toast({
        title: "Already Saved",
        description: "This content is already in your My Content section.",
      });
      return;
    }

    try {
      // Save free content to user's purchases
      const { error } = await supabase.from("purchases").insert({
        user_id: user.id,
        product_id: product.id,
        amount: 0,
        currency: "usd",
        status: "completed",
      });

      if (error) {
        console.error("Error saving free content:", error);
        toast({
          title: "Error",
          description: "Failed to save content. Please try again.",
          variant: "destructive",
        });
        return;
      }

      setIsSaved(true);
      toast({
        title: "Saved!",
        description: "This has been added to My Content.",
      });
    } catch (error) {
      console.error("Error saving free content:", error);
      toast({
        title: "Error",
        description: "Failed to save content. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePurchaseClick = async () => {
    if (isFreeProduct) {
      handleSaveFreeContent();
      return;
    }

    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to purchase this product.",
        variant: "destructive",
      });
      return;
    }

    // If already purchased and NOT a consultation, view content instead
    const isConsultation = product.product_type === "consultation";
    if (isPurchased && !isConsultation) {
      handleViewContent();
      return;
    }

    navigate(`/products/${product.id}/purchase`);
  };

  const handlePurchaseSuccess = (purchaseId: string) => {
    setShowPurchaseModal(false);
    setIsPurchased(true); // Update purchase status
    console.log("Purchase completed:", purchaseId);
  };

  const handleViewContent = () => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to view content.",
        variant: "destructive",
      });
      return;
    }

    // Check if user has access to full content
    const hasFullAccess = isFreeProduct ? isSaved : isPurchased;

    if (hasFullAccess) {
      // Show full content viewer for purchased/saved content
      setShowPreview(true);
    } else {
      // Show preview modal for non-purchased content (no error messages)
      setShowPreviewModal(true);
    }
  };
  const formatFileSize = (mb: number | null) => {
    if (!mb) return "";
    if (mb < 1) return `${Math.round(mb * 1024)} KB`;
    return `${mb.toFixed(1)} MB`;
  };
  const lessonCount = Math.max(
    productFiles.length,
    Number(product.total_files_count ?? 0),
  );
  const isCourse =
    lessonCount > 1 &&
    (product.product_type === "video" ||
      product.content_type === "course" ||
      product.has_multiple_files);

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <Card
      className={`flex flex-col rounded-[16px] max-w-full h-full border border-[#e5e5e5] bg-white shadow-[0px_0px_10px_0px_rgba(46,84,165,0.1)] overflow-hidden `}
    >
      {product.thumbnail_url &&
      product.thumbnail_url.trim() &&
      !product.thumbnail_url.includes("placeholder") ? (
        <div className="relative h-[99px] overflow-hidden rounded-tl-[16px] rounded-tr-[16px] flex-shrink-0">
          {/* Background Image */}
          <img
            src={product.thumbnail_url}
            alt={product.title}
            className="w-full h-full object-cover rounded-tl-[16px] rounded-tr-[16px]"
          />

          {/* Dark Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-transparent to-[70.707%] rounded-tl-[16px] rounded-tr-[16px]" />

          {/* Badges */}
          <div className="absolute inset-0 flex items-start justify-between p-4 rounded-tl-[16px] rounded-tr-[16px]">
            {/* Product Type Badge */}
            <div className="backdrop-blur-[2px] bg-white/35 rounded-full px-2 py-1.5 flex items-center">
              <p className="font-bold text-[10px] text-white tracking-[0.2px] leading-[22px] font-['Plus_Jakarta_Sans']">
                {isCourse ? "Course" : product.product_type}
              </p>
            </div>

            {/* Lesson Count Badge */}
            {lessonCount > 1 && (
              <div className="backdrop-blur-[2px] bg-white/35 rounded-full px-2 py-1.5 flex items-center">
                <p className="font-bold text-[10px] text-white tracking-[0.2px] leading-[22px] font-['Plus_Jakarta_Sans']">
                  {lessonCount} Lessons
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}
      {/* Fallback Graphics - Always present but conditionally visible */}
      <div
        className="relative w-full h-[99px] flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100"
        style={{
          display:
            !product.thumbnail_url ||
            product.thumbnail_url.includes("placeholder")
              ? "flex"
              : "none",
        }}
      >
        {/* {product.product_type === "video" ? (
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-xl">
                <Play className="h-10 w-10 text-white ml-1" />
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-700 mt-1">
              Video Content
            </p>
          </div>
        ) : product.product_type === "consultation" && product.expert ? (
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full overflow-hidden shadow-xl border-4 border-green-500">
              <Avatar className="w-full h-full">
                <AvatarImage
                  src={product.expert.profile_image_url || undefined}
                />
                <AvatarFallback className="bg-gradient-to-br from-green-500 to-green-600 text-white text-xl font-bold">
                  {product.expert.first_name?.[0] || "E"}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl">
                <File className="h-10 w-10 text-white" />
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-700 mt-1">Document</p>
          </div>
        )} */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-transparent to-[70.707%] rounded-tl-[16px] rounded-tr-[16px]" />
        <div className="absolute inset-0 flex items-start justify-between p-4 rounded-tl-[16px] rounded-tr-[16px]">
          {/* Product Type Badge */}
          <div className="backdrop-blur-[2px] bg-white/35 rounded-full px-2 py-1.5 flex items-center">
            <p className="font-bold text-[10px] text-white tracking-[0.2px] leading-[22px] font-['Plus_Jakarta_Sans']">
              {isCourse ? "Course" : product.product_type}
            </p>
          </div>

          {/* Lesson Count Badge */}
          {lessonCount > 1 && (
            <div className="backdrop-blur-[2px] bg-white/35 rounded-full px-2 py-1.5 flex items-center">
              <p className="font-bold text-[10px] text-white tracking-[0.2px] leading-[22px] font-['Plus_Jakarta_Sans']">
                {lessonCount} Lessons
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Content Section */}
      <CardContent className="flex flex-col gap-3 p-4 flex-1">
        {/* Title Section */}
        <div className="flex flex-col gap-3 w-full">
          {/* Title */}
          <h2 className="font-semibold text-[18px] leading-normal text-[#393939] font-['Plus_Jakarta_Sans'] truncate">
            {product.title}
          </h2>

          {/* Description */}
          <p className="font-normal text-[14px] leading-[19.6px] text-[#111111] font-['Plus_Jakarta_Sans'] line-clamp-3 break-words">
            {product.description}
          </p>
        </div>

        {/* Expert Info & Price Section */}
        <div className="flex flex-col gap-3 w-full mt-auto">
          {/* Expert Section */}
          <div className="flex items-start gap-3 w-full">
            {/* Avatar */}
            <Avatar className="w-9 h-9 rounded-full flex-shrink-0">
              <AvatarImage
                src={product.expert.profile_image_url}
                alt={product.expert.first_name}
              />
              <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold text-sm">
                {product.expert.first_name?.[0] || "E"}
              </AvatarFallback>
            </Avatar>

            {/* Expert Info */}
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <p className="font-semibold text-[14px] text-[#393939] font-['Plus_Jakarta_Sans'] truncate">
                {product.expert.first_name || "Expert"}
              </p>
              <p className="font-normal text-[12px] text-[#393939] font-['Plus_Jakarta_Sans'] truncate">
                {product.expert?.expert_specialties?.[0] || "Expert"}
              </p>
            </div>
          </div>

          {/* Price Section */}
          <div className="flex flex-col gap-0.5">
            <p className="font-semibold text-[12px] text-[#393939] font-['Plus_Jakarta_Sans']">
              {isCourse
                ? ""
                : isFreeProduct
                  ? "Free"
                  : formatCurrency(product.price)}
            </p>
            <p className="font-normal text-[10px] text-[#393939] font-['Plus_Jakarta_Sans']">
              {product.price > 0 &&
                !isFreeProduct &&
                !(product.product_type === "video") &&
                !isCourse && (
                  <span className="text-[10px] text-[#393939] leading-tight">
                    One-time purchase
                  </span>
                )}
            </p>
          </div>

          {/* Purchase Button */}
          <Button
            onClick={handlePurchaseClick}
            disabled={isFreeProduct && (isSaved || isCheckingStatus)}
            className="w-full bg-[#2E54A5] hover:bg-blue-700 text-[#E7ECFA] font-bold text-[14px] rounded-[8px] h-[44px] py-1.5 px-3 font-['Plus_Jakarta_Sans'] mt-2"
          >
            Purchase
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
