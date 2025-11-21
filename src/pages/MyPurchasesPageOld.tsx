import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, FileText, Video, Star, Calendar, Receipt, FileIcon } from 'lucide-react';
import { productService } from '@/services/products';
import { ContentGrid } from '@/components/content/ContentGrid';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export const MyPurchasesPage: React.FC = () => {
  const { user } = useAuth();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: purchases, isLoading, error } = useQuery({
    queryKey: ['user-purchases', user?.id],
    queryFn: () => user ? productService.getUserPurchases(user.id) : [],
    enabled: !!user,
  });

  const handleViewProduct = (productId: string) => {
    window.location.href = `/products/${productId}`;
  };

  const handleDownload = async (purchase: any) => {
    if (!user) {
      alert('Please log in to download products.');
      return;
    }

    setDownloadingId(purchase.product_id);

    try {
      // Get the current session to access the access token
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      
      if (!accessToken) {
        alert('Unable to authenticate. Please log in again.');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ product_id: purchase.product_id }),
      });
      
      const data = await response.json();
      
      if (data.has_access && data.product?.download_url) {
        // Create a temporary link and click it to start download
        const link = document.createElement('a');
        link.href = data.product.download_url;
        link.download = `${data.product.title}.${data.product.product_type === 'video' ? 'mp4' : 'pdf'}`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (data.has_access && !data.product?.download_url) {
        // User has access but file is missing
        alert('The product file is being prepared. Please try again in a few moments or contact support if the issue persists.');
      } else {
        alert(`Download failed: ${data.error || 'Unable to access product'}`);
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Download failed. Please try again later.');
    } finally {
      setDownloadingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Please log in to view your purchases.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">My Content</h1>
          <p className="text-gray-600 text-lg">
            Your purchased and free expert resources, ready when you need them
          </p>
          {purchases && purchases.length > 0 && (
            <div className="mt-4 text-sm text-gray-500">
              {purchases.length} {purchases.length === 1 ? 'product' : 'products'} in your library
            </div>
          )}
        </div>

        {/* Purchases List */}
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
                <p className="text-lg font-medium">Oops! Something went wrong</p>
                <p className="text-sm text-gray-600 mt-2">We couldn't load your purchases right now.</p>
              </div>
              <Button onClick={() => window.location.reload()} className="mt-4">
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : purchases && purchases.length > 0 ? (
          <ContentGrid
            purchases={purchases}
            onViewProduct={handleViewProduct}
            onDownload={handleDownload}
            downloadingId={downloadingId}
          />
        ) : (
          <Card className="shadow-lg border-2 border-dashed border-gray-300">
            <CardContent className="p-16 text-center">
              <div className="space-y-6">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-full flex items-center justify-center">
                  <Download className="h-10 w-10 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Your Library Awaits</h3>
                  <p className="text-gray-600 text-lg leading-relaxed max-w-md mx-auto">
                    You haven't purchased any expert resources yet. Discover valuable insights 
                    from our trusted parenting experts to support your family journey.
                  </p>
                </div>
                <div className="space-y-3">
                  <Button 
                    onClick={() => window.location.href = '/products'} 
                    size="lg" 
                    className="bg-blue-600 hover:bg-blue-700 px-8"
                  >
                    Explore Expert Resources
                  </Button>
                  <p className="text-sm text-gray-500">
                    💡 Expert-created content • 📱 Instant access • 🔒 Lifetime ownership
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};