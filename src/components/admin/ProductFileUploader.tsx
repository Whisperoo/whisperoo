import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Upload, Check, AlertCircle, FileText, Video } from 'lucide-react';
import { productService } from '@/services/products';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export const ProductFileUploader: React.FC = () => {
  const { user } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState<{ [key: string]: File }>({});
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [uploadStatus, setUploadStatus] = useState<{ [key: string]: 'success' | 'error' | 'uploading' }>({});

  // Fetch all products
  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ['all-products-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const handleFileSelect = (productId: string, file: File) => {
    setSelectedFiles(prev => ({ ...prev, [productId]: file }));
  };

  const handleUpload = async (productId: string) => {
    const file = selectedFiles[productId];
    const product = products?.find(p => p.id === productId);
    
    if (!file || !product) return;

    setUploadStatus(prev => ({ ...prev, [productId]: 'uploading' }));
    setUploadProgress(prev => ({ ...prev, [productId]: 0 }));

    try {
      // Upload file to storage
      const filePath = await productService.uploadProductFile(
        file,
        product.expert_id,
        productId
      );

      setUploadProgress(prev => ({ ...prev, [productId]: 50 }));

      // Calculate file size
      const fileSizeMB = file.size / (1024 * 1024);

      // Update product record with file path and size
      await productService.updateProduct(productId, {
        file_url: filePath,
        file_size_mb: fileSizeMB,
      });

      setUploadProgress(prev => ({ ...prev, [productId]: 100 }));
      setUploadStatus(prev => ({ ...prev, [productId]: 'success' }));
      
      // Refresh products list
      setTimeout(() => {
        refetch();
        setSelectedFiles(prev => {
          const newFiles = { ...prev };
          delete newFiles[productId];
          return newFiles;
        });
      }, 1500);
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadStatus(prev => ({ ...prev, [productId]: 'error' }));
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading products...</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload Files for Products</CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload missing product files or replace existing ones
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {products?.map((product) => (
              <div
                key={product.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold">{product.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={product.product_type === 'video' ? 'secondary' : 'default'}>
                        {product.product_type}
                      </Badge>
                      {product.file_url ? (
                        <Badge variant="outline" className="text-green-600">
                          <Check className="h-3 w-3 mr-1" />
                          File uploaded
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-600">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          No file
                        </Badge>
                      )}
                      {product.file_size_mb && (
                        <span className="text-sm text-muted-foreground">
                          {product.file_size_mb.toFixed(2)} MB
                        </span>
                      )}
                    </div>
                    {product.file_url && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Path: {product.file_url}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Input
                    type="file"
                    accept={product.product_type === 'video' ? 'video/*' : '.pdf,.doc,.docx'}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(product.id, file);
                    }}
                    className="flex-1"
                  />
                  
                  {selectedFiles[product.id] && (
                    <div className="text-sm text-muted-foreground">
                      {(selectedFiles[product.id].size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  )}

                  <Button
                    onClick={() => handleUpload(product.id)}
                    disabled={!selectedFiles[product.id] || uploadStatus[product.id] === 'uploading'}
                    size="sm"
                  >
                    {uploadStatus[product.id] === 'uploading' ? (
                      <>Uploading...</>
                    ) : uploadStatus[product.id] === 'success' ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Done
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-1" />
                        Upload
                      </>
                    )}
                  </Button>
                </div>

                {uploadProgress[product.id] !== undefined && uploadProgress[product.id] > 0 && (
                  <Progress value={uploadProgress[product.id]} className="h-2" />
                )}

                {uploadStatus[product.id] === 'error' && (
                  <p className="text-sm text-red-600">
                    Upload failed. Please try again.
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};