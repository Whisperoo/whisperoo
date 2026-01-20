import React, { useState, useEffect } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
} from "lucide-react";
import {
  ProductWithDetails,
  ProductFile,
  productService,
} from "@/services/products";
import { ContentViewer } from "./ContentViewer";

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

  // Course detection logic - similar to ProductDetailPage
  const isCourse = (product: ProductWithDetails) => {
    const files = productFiles[product.id] || [];
    return (
      files.length > 1 &&
      files.some(
        (file) =>
          file.file_type === "video" || file.mime_type?.startsWith("video/"),
      )
    );
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
  console.log(purchases);
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {purchases.map((purchase) => (
          <Card
            key={purchase.id}
            className="group hover:shadow-xl transition-all duration-300 h-full flex flex-col bg-white border border-gray-200 hover:border-blue-200 rounded-xl overflow-hidden"
          >
            {/* Thumbnail */}
            <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
              {purchase.product?.thumbnail_url &&
              !purchase.product.thumbnail_url.includes("placeholder") ? (
                <img
                  src={purchase.product.thumbnail_url}
                  alt={purchase.product.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              ) : (
                <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                      {purchase.product?.product_type === "video" ? (
                        <Video className="h-8 w-8 text-white" />
                      ) : (
                        <FileText className="h-8 w-8 text-white" />
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-700 mt-2">
                      {purchase.product?.product_type === "video"
                        ? "Video"
                        : "Document"}
                    </p>
                  </div>
                </div>
              )}

              {/* Play Button Overlay for Videos */}
              {purchase.product?.product_type === "video" && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="bg-black/75 rounded-full p-3">
                    <Play className="h-6 w-6 text-white ml-0.5" />
                  </div>
                </div>
              )}

              {/* Badges */}
              <div className="absolute top-3 left-3 right-3 flex justify-between">
                <Badge className="capitalize bg-white/95 text-gray-800 font-medium shadow-sm border border-white/50 backdrop-blur-sm text-xs">
                  {purchase.product && isCourse(purchase.product)
                    ? "Course"
                    : purchase.product?.product_type || "content"}
                </Badge>

                <div className="flex gap-2">
                  {purchase.product && isCourse(purchase.product) && (
                    <Badge className="bg-blue-600/95 text-white font-medium shadow-sm border border-blue-700 backdrop-blur-sm text-xs">
                      {productFiles[purchase.product.id]?.length || 0} lessons
                    </Badge>
                  )}
                  <Badge
                    className={`font-medium shadow-sm border backdrop-blur-sm text-xs ${
                      purchase.amount > 0
                        ? "bg-green-100/95 text-green-800 border-green-200"
                        : "bg-blue-100/95 text-blue-800 border-blue-200"
                    }`}
                  >
                    {purchase.amount > 0 ? `$${purchase.amount}` : "Free"}
                  </Badge>
                </div>
              </div>
            </div>
            {/* Content */}
            <CardContent className="p-4 flex-1">
              <div className="space-y-3">
                <h3 className="text-base font-bold text-gray-900 line-clamp-2 leading-tight min-h-[2.5rem]">
                  {purchase.product?.title || "Untitled Content"}
                </h3>

                {purchase.product?.description &&
                  purchase.product.description.trim() && (
                    <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                      {purchase.product.description}
                    </p>
                  )}

                {/* Metadata */}
                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                  {purchase.product && getTotalDuration(purchase.product) && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>
                        {isCourse(purchase.product) ? "Total: " : ""}
                        {formatDuration(getTotalDuration(purchase.product)!)}
                      </span>
                    </div>
                  )}

                  {purchase.product?.file_size_mb && (
                    <span>{formatFileSize(purchase.product.file_size_mb)}</span>
                  )}

                  {purchase.product?.page_count && (
                    <span>{purchase.product.page_count} pages</span>
                  )}
                </div>

                <div className="text-xs text-gray-500 pt-2 border-t">
                  Added {new Date(purchase.purchased_at).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
            {/* Actions */}
            {/* Actions - UPDATED WITH DOWNLOAD BUTTON */}
            <CardFooter className="pt-0 px-4 pb-4">
              <div className="w-full grid grid-cols-2 gap-2">
                {/* View Content Button */}
                {purchase.product && (
                  <Button
                    onClick={() => handlePreview(purchase.product!)}
                    size="sm"
                    variant="outline"
                    className="border-gray-300 hover:bg-gray-50 font-medium"
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
                      size="sm"
                      variant="default"
                      className="bg-blue-600 hover:bg-blue-700 font-medium"
                      disabled={downloadingId === purchase.product_id}
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
