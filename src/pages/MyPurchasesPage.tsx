import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Download, Calendar, CheckCircle, Clock, XCircle,
  BookOpen, Loader2, AlertCircle, RefreshCw, Search, Heart, Bell
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ContentGrid } from "@/components/content/ContentGrid";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { productService, ProductWithDetails } from "@/services/products";
import { formatCurrency } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface PurchaseWithDetails {
  id: string;
  amount: number | null;
  status: string;
  created_at: string;
  stripe_session_id?: string;
  consultation_completed: boolean;
  product?: any;
}

export const MyPurchasesPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const currentLang = i18n.language || 'en';
  const searchParams = new URLSearchParams(location.search);
  const rawTab = searchParams.get("tab") || "content";
  // "bookings" is a legacy alias for "appointments"
  const defaultTab = rawTab === "bookings" ? "appointments" : rawTab;

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'appointments' | 'wishlist'>(
    (defaultTab as 'content' | 'appointments' | 'wishlist') || 'content'
  );
  const [appointments, setAppointments] = useState<PurchaseWithDetails[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wishlistItems, setWishlistItems] = useState<ProductWithDetails[]>([]);
  const [loadingWishlist, setLoadingWishlist] = useState(false);

  const fetchAppointments = async () => {
    try {
      setLoadingAppointments(true);
      setError(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: bookings, error: bookingsError } = await supabase
        .from('consultation_bookings')
        .select(`
          id,
          status,
          booked_at,
          amount_paid,
          product_id
        `)
        .eq('user_id', user.id)
        .order('booked_at', { ascending: false });

      if (bookingsError) throw bookingsError;

      // Dedupe by booking ID (guards against data-layer double-inserts)
      const uniqueBookings = Array.from(
        new Map((bookings || []).map((b: any) => [b.id, b])).values()
      );

      const productIds = Array.from(
        new Set(uniqueBookings.map((b: any) => b.product_id).filter(Boolean)),
      ) as string[];

      // Load products separately (NO embedded relationships — avoid PostgREST 400s)
      const { data: products, error: productsError } = productIds.length
        ? await supabase
            .from('products')
            .select(`
              id,
              title,
              description,
              price,
              product_type,
              expert_id,
              booking_model,
              how_to_schedule
            `)
            .in('id', productIds)
        : { data: [], error: null };

      if (productsError) throw productsError;

      const expertIds = Array.from(
        new Set((products || []).map((p: any) => p.expert_id).filter(Boolean)),
      ) as string[];

      const { data: experts, error: expertsError } = expertIds.length
        ? await supabase
            .from('profiles')
            .select('id, first_name, profile_image_url, inquiry_confirmation_message, inquiry_prebook_message')
            .in('id', expertIds)
        : { data: [], error: null };

      if (expertsError) throw expertsError;

      const expertById = new Map<string, any>((experts || []).map((e: any) => [e.id, e]));

      const productById = new Map<string, any>(
        (products || []).map((p: any) => [
          p.id,
          {
            ...p,
            expert: p.expert_id ? expertById.get(p.expert_id) : null,
          },
        ]),
      );

      const validBookings = uniqueBookings.filter((b: any) => productById.has(b.product_id));

      const mappedAppointments: PurchaseWithDetails[] = validBookings.map((b: any) => ({
        id: b.id,
        amount: b.amount_paid ?? null,
        status: b.status,
        created_at: b.booked_at,
        consultation_completed: b.status === 'completed',
        product: productById.get(b.product_id)
      })) as PurchaseWithDetails[];

      setAppointments(mappedAppointments);
    } catch (err: any) {
      console.error('Error fetching appointments:', err, {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
      });
      const fallback =
        (typeof err === 'string' && err) ||
        err?.message ||
        err?.details ||
        err?.hint ||
        err?.code ||
        'Failed to load appointments';
      setError(fallback);
    } finally {
      setLoadingAppointments(false);
    }
  };

  useEffect(() => {
    if (user) fetchAppointments();
  }, [user]);

  // Realtime: notify user when admin updates their appointment status
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`booking-status-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'consultation_bookings',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newStatus = payload.new?.status as string | undefined;
          if (newStatus === 'confirmed') {
            toast({
              title: 'Appointment Confirmed',
              description: 'Your appointment request has been confirmed by the expert.',
            });
          } else if (newStatus === 'completed') {
            toast({
              title: 'Appointment Completed',
              description: 'Your appointment has been marked as completed.',
            });
          } else if (newStatus === 'cancelled') {
            toast({
              title: 'Appointment Cancelled',
              description: 'Your appointment has been cancelled.',
              variant: 'destructive',
            });
          }
          // Refresh the list to reflect the new status
          fetchAppointments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchWishlist = async () => {
    if (!user) return;
    setLoadingWishlist(true);
    try {
      const items = await productService.getUserWishlist(user.id);
      setWishlistItems(items);
    } catch (err) {
      console.error('Error fetching wishlist:', err);
    } finally {
      setLoadingWishlist(false);
    }
  };

  useEffect(() => {
    if (user && activeTab === 'wishlist') fetchWishlist();
  }, [user, activeTab]);

  const handleRemoveFromWishlist = async (productId: string) => {
    if (!user) return;
    await productService.toggleWishlist(productId, user.id);
    setWishlistItems(prev => prev.filter(p => p.id !== productId));
  };

  const handleViewProduct = (productId: string) => {
    window.location.href = `/products/${productId}`;
  };

  const downloadFile = async (response: Response, product: any) => {
    try {
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      const contentDisposition = response.headers.get("content-disposition");
      let filename = `${product?.title || "download"}.${product?.product_type === "video" ? "mp4" : "pdf"}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
      return true;
    } catch (error) {
      console.error("File download error:", error);
      return false;
    }
  };

  const downloadFileViaFetch = async (fileUrl: string, fileName: string) => {
    try {
      const cacheBusterUrl = `${fileUrl}${fileUrl.includes("?") ? "&" : "?"}_=${Date.now()}`;
      const response = await fetch(cacheBusterUrl, { mode: "cors", cache: "no-store", headers: { Accept: "application/pdf, application/octet-stream" } });
      const blob = await response.blob();
      const downloadBlob = new Blob([blob], { type: "application/octet-stream" });
      const blobUrl = window.URL.createObjectURL(downloadBlob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { document.body.removeChild(link); window.URL.revokeObjectURL(blobUrl); }, 100);
      return true;
    } catch (error) {
      console.error("Fallback download failed:", error);
      window.open(fileUrl, "_blank");
      return false;
    }
  };

  const handleDownload = async (purchase: any) => {
    if (!user) {
      alert("Please log in to download products.");
      return;
    }
    setDownloadingId(purchase.product_id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        alert("Unable to authenticate. Please log in again.");
        return;
      }
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ product_id: purchase.product_id }),
      });
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        if (data.has_access && data.product?.download_url) {
          await downloadFileViaFetch(data.product.download_url, `${data.product.title}.${data.product.product_type === "video" ? "mp4" : "pdf"}`);
        } else {
          alert(data.error || "Download failed");
        }
      } else {
        await downloadFile(response, purchase.product || purchase);
      }
    } catch (error) {
      console.error("Download error:", error);
      alert("Download failed. Please try again or contact support.");
    } finally {
      setDownloadingId(null);
    }
  };

  const { data: purchases, isLoading } = useQuery<any[]>({
    queryKey: ["purchases", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("purchases")
        .select(`id, product_id, amount, purchased_at, product:products (*, expert:profiles!products_expert_id_fkey (*))`)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return (data || []).filter((p: any) => {
        const product = Array.isArray(p.product) ? p.product[0] : p.product;
        return product && product.is_active === true && product.product_type !== 'consultation';
      });
    },
    enabled: !!user,
  });

  const filteredPurchases = purchases || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-7xl">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-[#1C3263] mb-1 sm:mb-2">{t('purchases.pageTitle')}</h1>
          <p className="text-black text-base sm:text-lg">{t('purchases.pageSubtitle')}</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'content' | 'appointments' | 'wishlist')} className="w-full">
          <TabsList className="w-full mb-6 bg-white border shadow-sm p-1 overflow-x-auto flex">
            <TabsTrigger value="content" className="flex-1 whitespace-nowrap px-3 sm:px-6 py-2.5 text-xs sm:text-sm data-[state=active]:bg-brand-primary/10 data-[state=active]:text-brand-primary data-[state=active]:shadow-none">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>{t('purchases.tabContent', { count: filteredPurchases.length })}</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="appointments" className="flex-1 whitespace-nowrap px-3 sm:px-6 py-2.5 text-xs sm:text-sm data-[state=active]:bg-brand-primary/10 data-[state=active]:text-brand-primary data-[state=active]:shadow-none">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>{t('purchases.tabAppointments', { count: appointments.length })}</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="wishlist" className="flex-1 whitespace-nowrap px-3 sm:px-6 py-2.5 text-xs sm:text-sm data-[state=active]:bg-brand-primary/10 data-[state=active]:text-brand-primary data-[state=active]:shadow-none">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>{t('purchases.tabWishlist', 'Wishlist')} {wishlistItems.length > 0 ? `(${wishlistItems.length})` : ''}</span>
              </div>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content">
            {isLoading ? (
              <div className="text-center py-16"><Loader2 className="animate-spin h-8 w-8 mx-auto text-blue-600" /></div>
            ) : filteredPurchases.length === 0 ? (
              <Card className="p-8 sm:p-16 text-center"><p>{t('purchases.noContentTitle')}</p></Card>
            ) : (
              <ContentGrid purchases={filteredPurchases} onViewProduct={handleViewProduct} onDownload={handleDownload} downloadingId={downloadingId} />
            )}
          </TabsContent>

          <TabsContent value="appointments" className="mt-0 space-y-6">
            {loadingAppointments ? (
              <div className="py-12 flex flex-col items-center justify-center text-gray-500 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <Loader2 className="h-8 w-8 animate-spin text-brand-primary mb-4" />
                <p>{t('purchases.loadingAppointments')}</p>
              </div>
            ) : error ? (
              <div className="py-12 flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-8 w-8 text-red-500" /></div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{t('purchases.errorTitle')}</h3>
                <p className="text-gray-500 mb-6">{t('purchases.errorDesc')}</p>
                <Button onClick={fetchAppointments} variant="outline"><RefreshCw className="mr-2 h-4 w-4" />{t('purchases.tryAgain')}</Button>
              </div>
            ) : appointments.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-gray-100 shadow-sm px-4">
                <div className="w-20 h-20 bg-brand-primary/5 rounded-full flex items-center justify-center mb-6"><Calendar className="h-10 w-10 text-brand-primary/40" /></div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{t('purchases.noAppointmentsTitle')}</h3>
                <p className="text-gray-500 max-w-md mx-auto mb-8">{t('purchases.noAppointmentsDesc')}</p>
                <Button onClick={() => navigate('/experts')} className="bg-brand-primary hover:bg-brand-primary/90 text-white rounded-full px-8 shadow-md h-12"><Search className="mr-2 h-4 w-4" />{t('purchases.browseExperts')}</Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {appointments.map((appointment) => {
                  const expertName = appointment.product?.expert?.first_name || t('purchases.defaultExpert');
                  const productTitle = appointment.product?.title || '';
                  const bookingModel = appointment.product?.booking_model as string | undefined;
                  const bookedDate = appointment.created_at
                    ? new Date(appointment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : null;
                  const amountPaid = appointment.amount != null && appointment.amount > 0
                    ? `$${Number(appointment.amount).toFixed(2)}`
                    : null;

                  const statusConfig: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
                    completed: {
                      bg: 'bg-emerald-50 border-emerald-200',
                      text: 'text-emerald-700',
                      icon: <CheckCircle className="h-4 w-4" />,
                      label: t('purchases.statusCompleted', 'Completed'),
                    },
                    confirmed: {
                      bg: 'bg-blue-50 border-blue-200',
                      text: 'text-blue-700',
                      icon: <CheckCircle className="h-4 w-4" />,
                      label: t('purchases.statusConfirmed', 'Confirmed'),
                    },
                    pending: {
                      bg: 'bg-amber-50 border-amber-200',
                      text: 'text-amber-700',
                      icon: <Clock className="h-4 w-4" />,
                      label: t('purchases.statusPending', 'Pending'),
                    },
                    cancelled: {
                      bg: 'bg-gray-100 border-gray-200',
                      text: 'text-gray-500',
                      icon: <XCircle className="h-4 w-4" />,
                      label: t('purchases.statusCancelled', 'Cancelled'),
                    },
                  };
                  const sc = statusConfig[appointment.status] || statusConfig.pending;

                  return (
                    <Card key={appointment.id} className="overflow-hidden border-gray-100 shadow-sm">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          {/* Avatar */}
                          {appointment.product?.expert?.profile_image_url ? (
                            <img
                              src={appointment.product.expert.profile_image_url}
                              alt={expertName}
                              className="w-12 h-12 rounded-full object-cover border border-gray-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-brand-primary font-bold text-lg">{expertName[0]?.toUpperCase() ?? '?'}</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            {/* Expert name + booking type pill */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-base text-gray-900">{expertName}</h3>
                              {bookingModel && (
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                  bookingModel === 'direct'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : bookingModel === 'hospital'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-gray-100 text-gray-600 border-gray-200'
                                }`}>
                                  {bookingModel === 'direct' ? 'Flat-Rate' : bookingModel === 'hospital' ? 'Hospital' : 'Inquiry'}
                                </span>
                              )}
                            </div>
                            {/* Product title */}
                            {productTitle && (
                              <p className="text-sm text-gray-600 mt-0.5 leading-snug">{productTitle}</p>
                            )}
                            {/* Booking date + amount */}
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                              {bookedDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {bookedDate}
                                </span>
                              )}
                              {amountPaid && (
                                <span className="font-semibold text-gray-600">{amountPaid}</span>
                              )}
                            </div>
                          </div>
                          {/* Status badge */}
                          <span className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${sc.bg} ${sc.text}`}>
                            {sc.icon}
                            {sc.label}
                          </span>
                        </div>

                        {/* Status message */}
                        <div className={`mt-4 rounded-lg p-3 border text-sm flex items-start gap-2 ${sc.bg} ${sc.text}`}>
                          <span className="flex-shrink-0 mt-0.5">{sc.icon}</span>
                          <span>
                            {appointment.status === 'completed' && t('purchases.consultationCompletedMsg', 'Your consultation has been completed.')}
                            {appointment.status === 'confirmed' && t('purchases.consultationConfirmedMsg', 'Your appointment is confirmed. The expert will be in touch with next steps.')}
                            {appointment.status === 'pending' && t('purchases.consultationPendingMsg', 'Your request is being reviewed. You\'ll hear back within 1–2 business days.')}
                            {appointment.status === 'cancelled' && t('purchases.consultationCancelledMsg', 'This appointment was cancelled. Contact support if you have questions.')}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="wishlist" className="mt-0">
            {loadingWishlist ? (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
              </div>
            ) : wishlistItems.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-gray-100 shadow-sm px-4">
                <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6">
                  <Heart className="h-10 w-10 text-rose-300" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{t('purchases.noWishlistTitle', 'No saved items yet')}</h3>
                <p className="text-gray-500 max-w-md mx-auto mb-8">
                  {t('purchases.noWishlistDesc', 'Tap the heart icon on any product to save it here.')}
                </p>
                <Button onClick={() => navigate('/products')} className="bg-brand-primary hover:bg-brand-primary/90 text-white rounded-full px-8 shadow-md h-12">
                  {t('purchases.browseProducts', 'Browse Products')}
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {wishlistItems.map((product) => (
                  <div key={product.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                    <div
                      className="flex-1 p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => navigate(`/products/${product.id}`)}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2">{product.title}</h3>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveFromWishlist(product.id); }}
                          className="flex-shrink-0 text-rose-500 hover:text-rose-700 transition-colors mt-0.5"
                          title="Remove from wishlist"
                        >
                          <Heart className="w-5 h-5 fill-current" />
                        </button>
                      </div>
                      {product.expert && (
                        <p className="text-sm text-gray-500 mb-2">by {product.expert.first_name}</p>
                      )}
                      {product.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
                      )}
                    </div>
                    <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="font-bold text-brand-primary">{formatCurrency(product.price)}</span>
                      <Button size="sm" onClick={() => navigate(`/products/${product.id}`)} className="bg-brand-primary hover:bg-brand-primary/90 text-white text-xs h-8 px-4 rounded-full">
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
