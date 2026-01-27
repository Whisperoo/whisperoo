import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Download, Receipt, Calendar, CheckCircle, Clock } from "lucide-react";
import { ContentGrid } from "@/components/content/ContentGrid";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

export const MyPurchasesPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Get tab from URL params, default to 'content'
  const searchParams = new URLSearchParams(location.search);
  const defaultTab = searchParams.get("tab") || "content";

  const handleViewProduct = (productId: string) => {
    window.location.href = `/products/${productId}`;
  };

  // NEW: Simple file download handler for proxied files
  const downloadFile = async (response: Response, product: any) => {
    try {
      // Get the file data as blob
      const blob = await response.blob();

      // Create a blob URL
      const blobUrl = window.URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement("a");
      link.href = blobUrl;

      // Get filename from Content-Disposition header or create default
      const contentDisposition = response.headers.get("content-disposition");
      let filename = `${product?.title || "download"}.${
        product?.product_type === "video" ? "mp4" : "pdf"
      }`;

      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      link.download = filename;

      // Add to DOM, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up blob URL
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 100);

      return true;
    } catch (error) {
      console.error("File download error:", error);
      return false;
    }
  };

  // OLD function - now used as fallback only
  const downloadFileViaFetch = async (fileUrl: string, fileName: string) => {
    try {
      // Add timestamp to bypass cache
      const cacheBusterUrl = `${fileUrl}${fileUrl.includes("?") ? "&" : "?"}_=${Date.now()}`;

      const response = await fetch(cacheBusterUrl, {
        mode: "cors",
        cache: "no-store",
        headers: {
          Accept: "application/pdf, application/octet-stream",
        },
      });

      const blob = await response.blob();
      const downloadBlob = new Blob([blob], {
        type: "application/octet-stream",
      });

      const blobUrl = window.URL.createObjectURL(downloadBlob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;

      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);

      return true;
    } catch (error) {
      console.error("Fallback download failed:", error);
      window.open(fileUrl, "_blank");
      return false;
    }
  };

  // const handleDownload = async (purchase: any) => {
  //   if (!user) {
  //     alert("Please log in to download products.");
  //     return;
  //   }

  //   setDownloadingId(purchase.product_id);

  //   try {
  //     // Get the current session to access the access token
  //     const {
  //       data: { session },
  //     } = await supabase.auth.getSession();
  //     const accessToken = session?.access_token;

  //     if (!accessToken) {
  //       alert("Unable to authenticate. Please log in again.");
  //       return;
  //     }

  //     const response = await fetch(
  //       `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-purchase`,
  //       {
  //         method: "POST",
  //         headers: {
  //           "Content-Type": "application/json",
  //           Authorization: `Bearer ${accessToken}`,
  //         },
  //         body: JSON.stringify({ product_id: purchase.product_id }),
  //       },
  //     );

  //     if (!response.ok) {
  //       throw new Error(`Download failed: ${response.status}`);
  //     }

  //     // Check content type to determine response type
  //     const contentType = response.headers.get("content-type") || "";

  //     if (contentType.includes("application/json")) {
  //       // FALLBACK CASE: Edge function returned JSON with URL
  //       const data = await response.json();

  //       if (data.has_access && data.product?.download_url) {
  //         console.log(
  //           "Using fallback download method with URL:",
  //           data.product.download_url,
  //         );

  //         await downloadFileViaFetch(
  //           data.product.download_url,
  //           `${data.product.title}.${data.product.product_type === "video" ? "mp4" : "pdf"}`,
  //         );
  //       } else if (data.has_access && !data.product?.download_url) {
  //         alert(
  //           "The product file is being prepared. Please try again in a few moments or contact support if the issue persists.",
  //         );
  //       } else {
  //         alert(`Download failed: ${data.error || "Unable to access product"}`);
  //       }
  //     } else {
  //       // SUCCESS CASE: Edge function returned the actual file
  //       console.log("Edge function returned file directly");
  //       console.log("Content-Type:", contentType);
  //       console.log(
  //         "Content-Disposition:",
  //         response.headers.get("content-disposition"),
  //       );

  //       await downloadFile(response, purchase.product || purchase);
  //     }
  //   } catch (error) {
  //     console.error("Download error:", error);
  //     alert("Download failed. Please try again or contact support.");
  //   } finally {
  //     setDownloadingId(null);
  //   }
  // };
  const handleDownload = async (purchase: any) => {
    if (!user) {
      alert("Please log in to download products.");
      return;
    }

    setDownloadingId(purchase.product_id);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        alert("Unable to authenticate. Please log in again.");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-purchase`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ product_id: purchase.product_id }),
        },
      );

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      // Check if response is a file or JSON
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        // Fallback case: edge function returned JSON
        const data = await response.json();

        if (data.has_access && data.product?.download_url) {
          console.log("Using fallback URL:", data.product.download_url);
          // Use your existing downloadFileViaFetch for fallback
          await downloadFileViaFetch(
            data.product.download_url,
            `${data.product.title}.${data.product.product_type === "video" ? "mp4" : "pdf"}`,
          );
        } else {
          alert(data.error || "Download failed");
        }
      } else {
        // SUCCESS: Edge function returned the file directly
        console.log("Edge function returned file directly");

        // Get the file as blob
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        // Get filename from header or use default
        const contentDisposition = response.headers.get("content-disposition");
        let filename = `${purchase.product?.title || "download"}.${
          purchase.product?.product_type === "video" ? "mp4" : "pdf"
        }`;

        if (contentDisposition) {
          const match = contentDisposition.match(/filename="(.+)"/);
          if (match) filename = match[1];
        }

        // Create and trigger download
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up
        setTimeout(() => {
          window.URL.revokeObjectURL(blobUrl);
        }, 100);
      }
    } catch (error) {
      console.error("Download error:", error);
      alert("Download failed. Please try again or contact support.");
    } finally {
      setDownloadingId(null);
    }
  };
  const {
    data: purchases,
    isLoading,
    error,
  } = useQuery<any[]>({
    queryKey: ["purchases", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("purchases")
        .select(
          `
          id,
          product_id,
          expert_id,
          amount,
          purchased_at,
          access_expires_at,
          consultation_completed,
          consultation_completed_at,
          product:products (
            id,
            title,
            description,
            price,
            product_type,
            file_url,
            primary_file_url,
            thumbnail_url,
            file_size_mb,
            duration_minutes,
            page_count,
            is_active,
            view_count,
            created_at,
            has_multiple_files,
            total_files_count,
            content_type,
            expert:profiles!products_expert_id_fkey (
              id,
              first_name,
              profile_image_url
            )
          )
        `,
        )
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("purchased_at", { ascending: false });

      if (error) throw error;

      // Filter out purchases of inactive/deleted products
      const activePurchases = (data || []).filter((purchase) => {
        return purchase.product && (purchase.product as any).is_active === true;
      });

      return activePurchases;
    },
    enabled: !!user,
  });

  // Separate consultations from other content
  const consultations =
    purchases?.filter(
      (p) => (p.product as any)?.product_type === "consultation",
    ) || [];
  const contentPurchases =
    purchases?.filter(
      (p) => (p.product as any)?.product_type !== "consultation",
    ) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#1C3263] mb-2">My Content</h1>
          <p className="text-black text-lg">
            Your purchased expert resources and consultation bookings
          </p>
          {purchases && purchases.length > 0 && (
            <div className="mt-4 hidden md:block text-sm text-gray-500">
              {contentPurchases.length} content{" "}
              {contentPurchases.length === 1 ? "item" : "items"} •{" "}
              {consultations.length}{" "}
              {consultations.length === 1 ? "booking" : "bookings"}
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="content">
              All Content ({contentPurchases.length})
            </TabsTrigger>
            <TabsTrigger value="bookings">
              My Bookings ({consultations.length})
            </TabsTrigger>
          </TabsList>

          {/* Content Tab */}
          <TabsContent value="content">
            {isLoading ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center gap-3 text-gray-600">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="text-lg">Loading your library...</span>
                </div>
              </div>
            ) : error ? (
              <Card className="shadow-lg">
                <CardContent className="p-8 text-center">
                  <div className="text-red-500 mb-4">
                    <Receipt className="h-12 w-12 mx-auto mb-3" />
                    <p className="text-lg font-medium">
                      Oops! Something went wrong
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      We couldn't load your purchases right now.
                    </p>
                  </div>
                  <Button
                    onClick={() => window.location.reload()}
                    className="mt-4"
                  >
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            ) : contentPurchases.length === 0 ? (
              <Card className="shadow-lg border-2 border-dashed border-gray-300">
                <CardContent className="p-16 text-center">
                  <div className="space-y-6">
                    <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-full flex items-center justify-center">
                      <Download className="h-10 w-10 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-3">
                        No Content Yet
                      </h3>
                      <p className="text-gray-600 text-lg leading-relaxed max-w-md mx-auto">
                        You haven't purchased any expert content yet. Browse our
                        collection of guides, courses, and resources.
                      </p>
                    </div>
                    <Button
                      onClick={() => (window.location.href = "/products")}
                      size="lg"
                    >
                      Browse Products
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <ContentGrid
                purchases={contentPurchases}
                onViewProduct={handleViewProduct}
                onDownload={handleDownload}
                downloadingId={downloadingId}
              />
            )}
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings">
            {isLoading ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center gap-3 text-gray-600">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="text-lg">Loading your bookings...</span>
                </div>
              </div>
            ) : consultations.length === 0 ? (
              <Card className="shadow-lg border-2 border-dashed border-gray-300">
                <CardContent className="p-16 text-center">
                  <div className="space-y-6">
                    <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-full flex items-center justify-center">
                      <Calendar className="h-10 w-10 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-3">
                        No Bookings Yet
                      </h3>
                      <p className="text-gray-600 text-lg leading-relaxed max-w-md mx-auto">
                        You haven't booked any consultations yet. Browse our
                        expert profiles to schedule a session.
                      </p>
                    </div>
                    <Button
                      onClick={() => (window.location.href = "/experts")}
                      size="lg"
                    >
                      Browse Experts
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {consultations.map((consultation) => (
                  <Card key={consultation.id} className="shadow-lg">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {(consultation as any).product?.title ||
                              "Consultation"}
                          </h3>
                          <p className="text-sm text-gray-600">
                            with{" "}
                            {(consultation as any).product?.expert
                              ?.first_name || "Expert"}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-900">
                            {formatCurrency(Number(consultation.amount))}
                          </div>
                          <Badge
                            variant={
                              consultation.consultation_completed
                                ? "default"
                                : "secondary"
                            }
                            className="mt-1"
                          >
                            {consultation.consultation_completed ? (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Completed
                              </>
                            ) : (
                              <>
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </>
                            )}
                          </Badge>
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 mb-4">
                        <div>
                          Booked:{" "}
                          {new Date(
                            consultation.purchased_at,
                          ).toLocaleDateString()}
                        </div>
                        {consultation.consultation_completed_at && (
                          <div>
                            Completed:{" "}
                            {new Date(
                              consultation.consultation_completed_at,
                            ).toLocaleDateString()}
                          </div>
                        )}
                      </div>

                      <div className="bg-blue-50 rounded-lg p-4 text-sm">
                        {consultation.consultation_completed ? (
                          <div className="text-green-700">
                            <CheckCircle className="h-4 w-4 inline mr-2" />
                            This consultation has been completed. Thank you for
                            booking with our expert!
                          </div>
                        ) : (
                          <div className="text-blue-700">
                            <Clock className="h-4 w-4 inline mr-2" />
                            The expert will reach out to you within 24 hours to
                            schedule your appointment.
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
