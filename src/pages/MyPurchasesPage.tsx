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
import { useTranslation } from "react-i18next";

interface PurchaseWithDetails {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  stripe_session_id?: string;
  consultation_completed: boolean;
  consultation_date?: string;
  product?: any;
}

export const MyPurchasesPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || 'en';
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'appointments'>('content');
  const [appointments, setAppointments] = useState<PurchaseWithDetails[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchParams = new URLSearchParams(location.search);
  const defaultTab = searchParams.get("tab") || "content";

  const fetchAppointments = async () => {
    try {
      setLoadingAppointments(true);
      setError(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('purchases')
        .select(`
          id,
          amount,
          status,
          purchased_at,
          consultation_completed,
          consultation_date,
          products (
            id,
            title,
            description,
            price,
            product_type,
            expert_id,
            experts:profiles!products_expert_id_fkey (
              id,
              first_name,
              last_name,
              title,
              profile_image_url
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('products.product_type', 'consultation')
        .order('purchased_at', { ascending: false });

      if (error) throw error;

      const validAppointments = (data || []).filter(p => p.products !== null);
      
      const mappedAppointments: PurchaseWithDetails[] = validAppointments.map(p => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        created_at: p.purchased_at,
        consultation_completed: p.consultation_completed,
        consultation_date: p.consultation_date,
        product: p.products
      })) as PurchaseWithDetails[];

      setAppointments(mappedAppointments);
    } catch (err: any) {
      console.error('Error fetching appointments:', err);
      setError(err.message || 'Failed to load appointments');
    } finally {
      setLoadingAppointments(false);
    }
  };

  useEffect(() => {
    if (user) fetchAppointments();
  }, [user]);

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
        .select(`id, product_id, amount, purchased_at, product:products (*)`)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return (data || []).filter((p) => p.product && p.product.is_active === true && p.product.product_type !== 'consultation');
    },
    enabled: !!user,
  });

  const filteredPurchases = purchases || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#1C3263] mb-2">{t('purchases.pageTitle')}</h1>
          <p className="text-black text-lg">{t('purchases.pageSubtitle')}</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'content' | 'appointments')} className="w-full">
          <TabsList className="w-full sm:w-auto mb-6 bg-white border shadow-sm p-1">
            <TabsTrigger value="content" className="flex-1 sm:flex-none px-6 py-2.5 data-[state=active]:bg-brand-primary/10 data-[state=active]:text-brand-primary data-[state=active]:shadow-none">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                <span>{t('purchases.tabContent', { count: filteredPurchases.length })}</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="appointments" className="flex-1 sm:flex-none px-6 py-2.5 data-[state=active]:bg-brand-primary/10 data-[state=active]:text-brand-primary data-[state=active]:shadow-none">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{t('purchases.tabAppointments', { count: appointments.length })}</span>
              </div>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content">
            {isLoading ? (
              <div className="text-center py-16"><Loader2 className="animate-spin h-8 w-8 mx-auto text-blue-600" /></div>
            ) : filteredPurchases.length === 0 ? (
              <Card className="p-16 text-center"><p>{t('purchases.noContentTitle')}</p></Card>
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
              <div className="grid gap-6">
                {appointments.map((appointment) => (
                  <Card key={appointment.id} className="overflow-hidden border-gray-100 shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg text-gray-900 truncate">
                            {appointment.product?.experts?.first_name ? `${appointment.product.experts.first_name} ${appointment.product.experts.last_name || ''}` : t('purchases.defaultExpert')}
                          </h3>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-4 text-sm mt-4">
                          {appointment.consultation_completed ? (
                            <div className="text-green-700">
                              <CheckCircle className="h-4 w-4 inline mr-2" />
                              {t('purchases.consultationCompletedMsg')}
                            </div>
                          ) : (
                            <div className="text-blue-700">
                              <Clock className="h-4 w-4 inline mr-2" />
                              {t('purchases.consultationPendingMsg')}
                            </div>
                          )}
                        </div>
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
