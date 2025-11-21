import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Upload, X, FileText, Video, Image } from 'lucide-react';
import { productService } from '@/services/products';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { MultiFileUploader, FileWithTitle } from './MultiFileUploader';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { getCurrentLimits, validateFile } from '@/config/upload';

const productSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.number().min(0, 'Price must be 0 or greater'),
  productType: z.enum(['video', 'document', 'mixed', 'consultation']),
  contentType: z.enum(['single', 'bundle', 'course', 'collection']),
  categoryIds: z.array(z.string()).min(1, 'Select at least one category'),
  durationMinutes: z.number().optional(),
  pageCount: z.number().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProductUploadModal: React.FC<ProductUploadModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [productFiles, setProductFiles] = useState<FileWithTitle[]>([]);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<'single' | 'multiple'>('single');
  const [singleProductFile, setSingleProductFile] = useState<File | null>(null);
  const [lastSubmissionTime, setLastSubmissionTime] = useState<number>(0);
  
  // Get current upload limits
  const limits = getCurrentLimits();

  const { data: categories } = useQuery({
    queryKey: ['product-categories'],
    queryFn: () => productService.getCategories(),
  });

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      title: '',
      description: '',
      price: 0,
      productType: 'document',
      contentType: 'single',
      categoryIds: [],
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'product' | 'thumbnail') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'product') {
      setSingleProductFile(file);
      
      // Auto-detect product type
      if (file.type.startsWith('video/')) {
        form.setValue('productType', 'video');
      } else {
        form.setValue('productType', 'document');
      }
    } else {
      setThumbnailFile(file);
    }
  };

  const handleMultipleFilesChange = (files: FileWithTitle[]) => {
    setProductFiles(files);
    
    // Auto-detect content type based on number of files
    if (files.length > 1) {
      form.setValue('contentType', 'bundle');
      
      // Check if we have mixed file types
      const hasVideo = files.some(f => f.file.type.startsWith('video/'));
      const hasDocument = files.some(f => 
        f.file.type.includes('pdf') || 
        f.file.type.includes('document') || 
        f.file.type.includes('text')
      );
      
      if (hasVideo && hasDocument) {
        form.setValue('productType', 'mixed');
      } else if (hasVideo) {
        form.setValue('productType', 'video');
      } else {
        form.setValue('productType', 'document');
      }
    } else if (files.length === 1) {
      form.setValue('contentType', 'single');
      
      // Auto-detect product type for single file
      if (files[0].file.type.startsWith('video/')) {
        form.setValue('productType', 'video');
      } else {
        form.setValue('productType', 'document');
      }
    }
  };

  const onSubmit = async (data: ProductFormData) => {
    const filesToUpload = uploadMode === 'multiple' ? productFiles.map(f => f.file) : (singleProductFile ? [singleProductFile] : []);
    const fileTitles = uploadMode === 'multiple' ? productFiles.map(f => f.displayTitle) : [];
    
    if (!user || filesToUpload.length === 0) return;
    if (isUploading) return; // Prevent duplicate submissions
    
    // Prevent rapid submissions (debounce)
    const now = Date.now();
    if (now - lastSubmissionTime < 2000) { // 2 second debounce
      console.warn('Upload attempted too soon after previous attempt');
      return;
    }
    setLastSubmissionTime(now);

    setIsUploading(true);
    setUploadProgress(0);

    try {
      setUploadProgress(20);
      
      // Get the user's profile to ensure they're an expert
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, account_type')
        .eq('id', user.id)
        .single();

      if (!profile) {
        throw new Error('User profile not found');
      }

      setUploadProgress(40);

      // Create product with file(s) upload
      const product = uploadMode === 'multiple' && filesToUpload.length > 1
        ? await productService.createProductWithMultipleFiles(
            {
              title: data.title,
              description: data.description,
              price: data.price,
              product_type: data.productType === 'consultation' ? 'document' : data.productType as any,
              expert_id: profile.id,
              content_type: data.contentType,
            },
            filesToUpload,
            fileTitles,
            thumbnailFile || undefined
          )
        : await productService.createProductWithFile(
            {
              title: data.title,
              description: data.description,
              price: data.price,
              product_type: data.productType === 'consultation' ? 'document' : data.productType as any,
              expert_id: profile.id,
              duration_minutes: data.durationMinutes,
              page_count: data.pageCount,
            },
            filesToUpload[0],
            thumbnailFile || undefined
          );

      setUploadProgress(70);

      // Add category mappings
      if (data.categoryIds.length > 0) {
        const categoryMappings = data.categoryIds.map(categoryId => ({
          product_id: product.id,
          category_id: categoryId,
        }));

        await supabase
          .from('product_category_mappings')
          .insert(categoryMappings);
      }

      setUploadProgress(100);
      
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Failed to upload product: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    form.reset();
    setSingleProductFile(null);
    setProductFiles([]);
    setThumbnailFile(null);
    setUploadProgress(0);
    setUploadMode('single');
    setLastSubmissionTime(0); // Reset debounce timer
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload New Product</DialogTitle>
          <DialogDescription>
            Add a new digital product to your catalog. Fill in the details and upload your files.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter product title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your product..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Price and Type */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (USD)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="productType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="document">Document</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="mixed">Mixed Content</SelectItem>
                        <SelectItem value="consultation">Consultation</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Additional fields based on type */}
            {form.watch('productType') === 'video' && (
              <FormField
                control={form.control}
                name="durationMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter duration"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {form.watch('productType') === 'document' && (
              <FormField
                control={form.control}
                name="pageCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Page Count</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter page count"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Categories */}
            <FormField
              control={form.control}
              name="categoryIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categories</FormLabel>
                  <div className="grid grid-cols-2 gap-3">
                    {categories?.map((category) => (
                      <div key={category.id} className="flex items-center space-x-2">
                        <Checkbox
                          checked={field.value?.includes(category.id)}
                          onCheckedChange={(checked) => {
                            const updatedValue = checked
                              ? [...(field.value || []), category.id]
                              : field.value?.filter((id) => id !== category.id) || [];
                            field.onChange(updatedValue);
                          }}
                        />
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          {category.name}
                        </label>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Upload Mode Selection */}
            <div className="space-y-2">
              <FormLabel>Upload Mode</FormLabel>
              <RadioGroup value={uploadMode} onValueChange={(value) => setUploadMode(value as 'single' | 'multiple')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="single" id="single" />
                  <Label htmlFor="single">Single File</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="multiple" id="multiple" />
                  <Label htmlFor="multiple">Multiple Files (Bundle/Course)</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Content Type for Multiple Files */}
            {uploadMode === 'multiple' && productFiles.length > 1 && (
              <FormField
                control={form.control}
                name="contentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select content type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="bundle">Bundle (Related files)</SelectItem>
                        <SelectItem value="course">Course (Structured learning)</SelectItem>
                        <SelectItem value="collection">Collection (Curated set)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose how your files are organized
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* File Upload */}
            <div className="space-y-4">
              {uploadMode === 'multiple' ? (
                <div>
                  <FormLabel>Product Files</FormLabel>
                  <MultiFileUploader
                    onFilesChange={handleMultipleFilesChange}
                    maxFiles={limits.maxFiles}
                    acceptedFileTypes={['video/*', 'application/pdf', 'image/*', 'audio/*']}
                    className="mt-2"
                  />
                </div>
              ) : (
              <div>
                <FormLabel>Product File</FormLabel>
                <div className="mt-2">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      {singleProductFile ? (
                        <>
                          {form.watch('productType') === 'video' ? (
                            <Video className="w-8 h-8 mb-2 text-muted-foreground" />
                          ) : (
                            <FileText className="w-8 h-8 mb-2 text-muted-foreground" />
                          )}
                          <p className="text-sm">{singleProductFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(singleProductFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Click to upload product file
                          </p>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept={form.watch('productType') === 'video' 
                        ? 'video/*' 
                        : '.pdf,.doc,.docx,.epub,.mobi'}
                      onChange={(e) => handleFileChange(e, 'product')}
                    />
                  </label>
                </div>
              </div>
              )}

              <div>
                <FormLabel>Thumbnail Image (Optional)</FormLabel>
                <div className="mt-2">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      {thumbnailFile ? (
                        <>
                          <Image className="w-8 h-8 mb-2 text-muted-foreground" />
                          <p className="text-sm">{thumbnailFile.name}</p>
                        </>
                      ) : (
                        <>
                          <Image className="w-8 h-8 mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Click to upload thumbnail
                          </p>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'thumbnail')}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="w-full" />
                <p className="text-sm text-center text-muted-foreground">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
              type="submit" 
              disabled={
                isUploading || 
                (uploadMode === 'single' ? !singleProductFile : productFiles.length === 0 || productFiles.some(f => !f.displayTitle.trim()))
              }
              className="disabled:cursor-not-allowed disabled:opacity-50"
            >
                {isUploading ? 'Uploading...' : 'Upload Product'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};