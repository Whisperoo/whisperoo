import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Video,
  FileText,
  Clock,
  Download,
  Play,
  Eye,
  Loader2,
  File,
} from "lucide-react";
import {
  ProductWithDetails,
  ProductFile,
  productService,
} from "@/services/products";
import { ContentViewer } from "./ContentViewer";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

interface Purchase {
  id: string;
  product_id: string;
  amount: number;
  purchased_at: string;
  product?: ProductWithDetails;
}

interface ContentGridProps {
  purchases: Purchase[];
  onViewProduct: (productId: string) => void;
  onDownload: (purchase: Purchase) => void;
  downloadingId: string | null;
}

export const ContentGrid: React.FC<ContentGridProps> = ({
  purchases,
  onViewProduct,
  onDownload,
  downloadingId,
}) => {
  const [previewProduct, setPreviewProduct] =
    useState<ProductWithDetails | null>(null);
  const [productFiles, setProductFiles] = useState<
    Record<string, ProductFile[]>
  >({});

  // Load product files for multi-file products
  useEffect(() => {
    const loadProductFiles = async () => {
      const multiFileProducts = purchases.filter(
        (p) =>
          p.product?.has_multiple_files ||
          (p.product?.total_files_count && p.product.total_files_count > 1),
      );

      for (const purchase of multiFileProducts) {
        if (purchase.product && !productFiles[purchase.product.id]) {
          try {
            const files = await productService.getProductFiles(
              purchase.product.id,
            );
            setProductFiles((prev) => ({
              ...prev,
              [purchase.product!.id]: files,
            }));
          } catch (error) {
            console.error("Failed to load product files:", error);
          }
        }
      }
    };

    if (purchases.length > 0) {
      loadProductFiles();
    }
  }, [purchases]);

  const handlePreview = (product: ProductWithDetails) => {
    setPreviewProduct(product);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const formatFileSize = (sizeInMB: number) => {
    if (sizeInMB < 1) return `${Math.round(sizeInMB * 1024)} KB`;
    return `${sizeInMB.toFixed(1)} MB`;
  };
  const lessonCount = (product: ProductWithDetails) => {
    const files = productFiles[product.id];

    // If we have loaded files, use that count
    if (files && files.length > 0) {
      return files.length;
    }

    // Otherwise fall back to total_files_count
    return product.total_files_count || 0;
  };

  // Course detection logic - similar to ProductDetailPage
  // const isCourse = (product: ProductWithDetails) => {
  //   const count = lessonCount(product);
  //   return (
  //     count > 1 &&
  //     (product.product_type === "video" ||
  //       product.content_type === "course" ||
  //       product.has_multiple_files)
  //   );
  //   // const files = productFiles[product.id] || [];
  //   // return (
  //   //   files.length > 1 &&
  //   //   files.some(
  //   //     (file) =>
  //   //       file.file_type === "video" || file.mime_type?.startsWith("video/"),
  //   //   )
  //   // );
  // };
  const isCourse = (product: ProductWithDetails) => {
    const count = lessonCount(product);

    // Explicit course content type always means course
    if (product.content_type === "course") return true;

    // For video products, require multiple files to be a course
    if (product.product_type === "video") {
      return count > 1 || product.has_multiple_files;
    }

    // For other types, use has_multiple_files flag
    return product.has_multiple_files === true;
  };

  // Get total duration for courses
  const getTotalDuration = (product: ProductWithDetails) => {
    if (!isCourse(product)) return product.duration_minutes;
    const files = productFiles[product.id] || [];
    return files.reduce(
      (total, file) => total + (file.duration_minutes || 0),
      0,
    );
  };

  // <Card
  //   className={`flex flex-col rounded-[16px] max-w-full h-full border border-[#e5e5e5] bg-white shadow-[0px_0px_10px_0px_rgba(46,84,165,0.1)] overflow-hidden `}
  // >
  //   {/* Content Section */}
  //   <CardContent className="flex flex-col gap-3 p-4 flex-1">
  //     {/* Title Section */}
  //     <div className="flex flex-col gap-3 w-full">
  //       {/* Title */}
  //       <h2 className="font-semibold text-[18px] leading-normal text-[#393939] font-['Plus_Jakarta_Sans'] truncate">
  //         {product.title}
  //       </h2>

  //       {/* Description */}
  //       <p className="font-normal text-[14px] leading-[19.6px] text-[#111111] font-['Plus_Jakarta_Sans'] line-clamp-3 break-words">
  //         {product.description}
  //       </p>
  //     </div>

  //     {/* Expert Info & Price Section */}
  //     <div className="flex flex-col gap-3 w-full mt-auto">
  //       {/* Expert Section */}
  //       <div className="flex items-start gap-3 w-full">
  //         {/* Avatar */}
  //         <Avatar className="w-9 h-9 rounded-full flex-shrink-0">
  //           <AvatarImage
  //             src={product.expert.profile_image_url}
  //             alt={product.expert.first_name}
  //           />
  //           <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold text-sm">
  //             {product.expert.first_name?.[0] || "E"}
  //           </AvatarFallback>
  //         </Avatar>

  //         {/* Expert Info */}
  //         <div className="flex flex-col gap-0.5 flex-1 min-w-0">
  //           <p className="font-semibold text-[14px] text-[#393939] font-['Plus_Jakarta_Sans'] truncate">
  //             {product.expert.first_name || "Expert"}
  //           </p>
  //           <p className="font-normal text-[12px] text-[#393939] font-['Plus_Jakarta_Sans'] truncate">
  //             {product.expert?.expert_specialties?.[0] || "Expert"}
  //           </p>
  //         </div>
  //       </div>

  //       {/* Price Section */}
  //       <div className="flex flex-col gap-0.5">
  //         <p className="font-semibold text-[12px] text-[#393939] font-['Plus_Jakarta_Sans']">
  //           {isCourse
  //             ? ""
  //             : isFreeProduct
  //               ? "Free"
  //               : formatCurrency(product.price)}
  //         </p>
  //         <p className="font-normal text-[10px] text-[#393939] font-['Plus_Jakarta_Sans']">
  //           {product.price > 0 &&
  //             !isFreeProduct &&
  //             !(product.product_type === "video") &&
  //             !isCourse && (
  //               <span className="text-[10px] text-[#393939] leading-tight">
  //                 One-time purchase
  //               </span>
  //             )}
  //         </p>
  //       </div>

  //       {/* Purchase Button */}
  //     </div>
  //   </CardContent>
  // </Card>;
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {purchases.map((purchase) => (
          <Card
            className={`flex flex-col rounded-[16px] max-w-full h-full border border-[#e5e5e5] bg-white shadow-[0px_0px_10px_0px_rgba(46,84,165,0.1)] overflow-hidden `}
            key={purchase.id}
          >
            {/* Thumbnail */}
            {purchase.product.thumbnail_url &&
            purchase.product.thumbnail_url.trim() &&
            !purchase.product.thumbnail_url.includes("placeholder") ? (
              <div className="relative h-[99px] overflow-hidden rounded-tl-[16px] rounded-tr-[16px] flex-shrink-0">
                {/* Background Image */}
                <img
                  src={purchase.product.thumbnail_url}
                  alt={purchase.product.title}
                  className="w-full h-full object-cover rounded-tl-[16px] rounded-tr-[16px]"
                />

                {/* Dark Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-transparent to-[70.707%] rounded-tl-[16px] rounded-tr-[16px]" />

                {/* Badges */}
                <div className="absolute inset-0 flex items-start justify-between p-4 rounded-tl-[16px] rounded-tr-[16px]">
                  {/* Product Type Badge */}
                  <div className="backdrop-blur-[2px] bg-white/35 rounded-full px-2 py-1.5 flex items-center">
                    <p className="font-bold text-[10px] text-white tracking-[0.2px] leading-[22px] font-['Plus_Jakarta_Sans']">
                      {isCourse(purchase.product)
                        ? "Course"
                        : purchase.product.product_type}
                    </p>
                  </div>

                  {/* Lesson Count Badge */}
                  {lessonCount(purchase.product) > 1 && (
                    <div className="backdrop-blur-[2px] bg-white/35 rounded-full px-2 py-1.5 flex items-center">
                      <p className="font-bold text-[10px] text-white tracking-[0.2px] leading-[22px] font-['Plus_Jakarta_Sans']">
                        {lessonCount(purchase.product)} Lessons
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
                  !purchase.product.thumbnail_url ||
                  purchase.product.thumbnail_url.includes("placeholder")
                    ? "flex"
                    : "none",
              }}
            >
              {/* {purchase.product.product_type === "video" ? (
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
              ) : purchase.product.product_type === "consultation" &&
                purchase.product.expert ? (
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full overflow-hidden shadow-xl border-4 border-green-500">
                    <Avatar className="w-full h-full">
                      <AvatarImage
                        src={
                          purchase.product.expert.profile_image_url || undefined
                        }
                      />
                      <AvatarFallback className="bg-gradient-to-br from-green-500 to-green-600 text-white text-xl font-bold">
                        {purchase.product.expert.first_name?.[0] || "E"}
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
                  <p className="text-sm font-semibold text-gray-700 mt-1">
                    Document
                  </p>
                </div>
              )} */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-transparent to-[70.707%] rounded-tl-[16px] rounded-tr-[16px]" />
              <div className="absolute inset-0 flex items-start justify-between p-4 rounded-tl-[16px] rounded-tr-[16px]">
                {/* Product Type Badge */}
                <div className="backdrop-blur-[2px] bg-white/35 rounded-full px-2 py-1.5 flex items-center">
                  <p className="font-bold text-[10px] text-white tracking-[0.2px] leading-[22px] font-['Plus_Jakarta_Sans']">
                    {isCourse(purchase.product)
                      ? "Course"
                      : purchase.product.product_type}
                  </p>
                </div>

                {/* Lesson Count Badge */}
                {lessonCount(purchase.product) > 1 && (
                  <div className="backdrop-blur-[2px] bg-white/35 rounded-full px-2 py-1.5 flex items-center">
                    <p className="font-bold text-[10px] text-white tracking-[0.2px] leading-[22px] font-['Plus_Jakarta_Sans']">
                      {lessonCount(purchase.product)} Lessons
                    </p>
                  </div>
                )}
              </div>
            </div>
            {/* Content */}
            <CardContent className="flex flex-col gap-3 p-4 flex-1">
              {/* Title Section */}{" "}
              <div className="flex flex-col gap-3 w-full">
                {/* Title */}{" "}
                <h2 className="font-semibold text-[18px] leading-normal text-[#393939] font-['Plus_Jakarta_Sans'] truncate">
                  {purchase.product.title}{" "}
                </h2>
                {/* Description */}{" "}
                <p className="font-normal text-[14px] leading-[19.6px] text-[#111111] font-['Plus_Jakarta_Sans'] line-clamp-3 break-words">
                  {purchase.product.description}{" "}
                </p>{" "}
              </div>
              {/* Expert Info & Price Section */}{" "}
              <div className="flex flex-col gap-3 w-full mt-auto">
                {/* Expert Section */}{" "}
                <div className="flex items-start gap-3 w-full">
                  {/* Avatar */}{" "}
                  <Avatar className="w-9 h-9 rounded-full flex-shrink-0">
                    {" "}
                    <AvatarImage
                      src={purchase.product.expert.profile_image_url}
                      alt={purchase.product.expert.first_name}
                    />
                    <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold text-sm">
                      {purchase.product.expert.first_name?.[0] || "E"}
                    </AvatarFallback>
                  </Avatar>
                  {/* Expert Info */}
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <p className="font-semibold text-[14px] text-[#393939] font-['Plus_Jakarta_Sans'] truncate">
                      {purchase.product.expert.first_name || "Expert"}
                    </p>
                    <p className="font-normal text-[12px] text-[#393939] font-['Plus_Jakarta_Sans'] truncate">
                      {purchase.product.expert?.expert_specialties?.[0] ||
                        "Expert"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            {/* Actions */}
            {/* Actions - UPDATED WITH DOWNLOAD BUTTON */}
            <CardFooter className="p-0 pl-4 pb-4 pr-4 pt-3">
              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-2">
                {/* View Content Button */}
                {purchase.product && (
                  <Button
                    onClick={() => handlePreview(purchase.product!)}
                    variant="outline"
                    className="w-full border-gray-300 font-bold text-[14px] rounded-[8px] h-[44px] py-1.5 px-3 font-['Plus_Jakarta_Sans']"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                )}

                {/* Download Button - NEW */}
                {purchase.product &&
                  purchase.product.product_type !== "consultation" &&
                  purchase.product.product_type === "document" && (
                    <Button
                      onClick={() => onDownload(purchase)}
                      disabled={downloadingId === purchase.product_id}
                      className="w-full bg-[#2E54A5] hover:bg-blue-700 text-[#E7ECFA] font-bold text-[14px] rounded-[8px] h-[44px] py-1.5 px-3 font-['Plus_Jakarta_Sans']"
                    >
                      {downloadingId === purchase.product_id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {/* Downloading... */}
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </>
                      )}
                    </Button>
                  )}
              </div>
            </CardFooter>{" "}
          </Card>
        ))}
      </div>

      {/* Content Viewer Modal */}
      {previewProduct && (
        <ContentViewer
          open={!!previewProduct}
          onClose={() => setPreviewProduct(null)}
          product={previewProduct}
        />
      )}
    </>
  );
};
