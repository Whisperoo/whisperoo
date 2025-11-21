import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database.types';
import { validateFile as validateFileUpload, getCurrentLimits, STORAGE_CONFIG } from '@/config/upload';

type Product = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductCategory = Database['public']['Tables']['product_categories']['Row'];
type Purchase = Database['public']['Tables']['purchases']['Row'];
type ProductReview = Database['public']['Tables']['product_reviews']['Row'];
type ProductCategoryMapping = Database['public']['Tables']['product_category_mappings']['Row'];
type ProductFile = Database['public']['Tables']['product_files']['Row'];
type ProductFileInsert = Database['public']['Tables']['product_files']['Insert'];

export type { ProductFile, ProductFileInsert };

export interface ProductWithDetails extends Product {
  expert?: {
    id: string;
    first_name: string;
    profile_image_url?: string;
  };
  categories?: ProductCategory[];
  average_rating?: number;
  total_reviews?: number;
  files?: ProductFile[];
}

export interface ProductFilters {
  expertId?: string; // profiles.id where account_type = 'expert'
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  productType?: 'video' | 'document' | 'consultation';
  sortBy?: 'created_at' | 'price' | 'rating' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export const productService = {
  // Get products with filters
  async getProducts(
    filters: ProductFilters = {},
    page = 1,
    limit = 12
  ): Promise<{ products: ProductWithDetails[]; total: number }> {
    let query = supabase
      .from('products')
      .select(
        `
        *,
        expert:profiles!products_expert_id_fkey(
          id,
          first_name,
          profile_image_url
        ),
        categories:product_category_mappings(
          category:product_categories(*)
        ),
        reviews:product_reviews(rating)
      `,
        { count: 'exact' }
      )
      .eq('is_active', true);

    // Apply filters
    if (filters.expertId) {
      query = query.eq('expert_id', filters.expertId);
    }
    if (filters.productType) {
      query = query.eq('product_type', filters.productType);
    }
    if (filters.minPrice !== undefined) {
      query = query.gte('price', filters.minPrice);
    }
    if (filters.maxPrice !== undefined) {
      query = query.lte('price', filters.maxPrice);
    }

    // Apply sorting
    const sortBy = filters.sortBy || 'created_at';
    const sortOrder = filters.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const start = (page - 1) * limit;
    const end = start + limit - 1;
    query = query.range(start, end);

    const { data, error, count } = await query;

    if (error) throw error;

    // Calculate average ratings
    const productsWithRatings = data?.map((product) => {
      const ratings = product.reviews?.map((r: { rating: number }) => r.rating).filter(Boolean) || [];
      const averageRating = ratings.length > 0
        ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length
        : null;

      return {
        ...product,
        average_rating: averageRating,
        total_reviews: ratings.length,
      };
    }) || [];

    // Filter by category if specified
    let filteredProducts = productsWithRatings;
    if (filters.category) {
      filteredProducts = productsWithRatings.filter((product) =>
        product.categories?.some((c: { category?: { slug: string } }) => c.category?.slug === filters.category)
      );
    }

    return {
      products: filteredProducts as ProductWithDetails[],
      total: count || 0,
    };
  },

  // Get single product by ID
  async getProduct(productId: string): Promise<ProductWithDetails | null> {
    const { data, error } = await supabase
      .from('products')
      .select(
        `
        *,
        expert:profiles!products_expert_id_fkey(
          id,
          first_name,
          profile_image_url
        ),
        categories:product_category_mappings(
          category:product_categories(*)
        ),
        reviews:product_reviews(*),
        files:product_files(*)
      `
      )
      .eq('id', productId)
      .single();

    if (error) throw error;

    // Calculate average rating
    const ratings = data.reviews?.map((r: { rating: number }) => r.rating).filter(Boolean) || [];
    const averageRating = ratings.length > 0
      ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length
      : null;

    return {
      ...data,
      average_rating: averageRating,
      total_reviews: ratings.length,
      files: data.files || [],
    } as ProductWithDetails;
  },

  // Create a new product
  async createProduct(product: ProductInsert): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Create product with file upload
  async createProductWithFile(
    productData: {
      title: string;
      description: string;
      price: number;
      product_type: 'video' | 'document';
      expert_id: string;
      duration_minutes?: number;
      page_count?: number;
    },
    file: File,
    thumbnail?: File
  ): Promise<Product> {
    // Calculate file size
    const fileSizeMB = file.size / (1024 * 1024);

    // Create product record first
    const product = await this.createProduct({
      title: productData.title,
      description: productData.description,
      price: productData.price,
      product_type: productData.product_type,
      expert_id: productData.expert_id,
      is_active: true,
      file_size_mb: fileSizeMB,
      duration_minutes: productData.duration_minutes,
      page_count: productData.page_count,
    } as ProductInsert);

    try {
      // Upload the product file
      const filePath = await this.uploadProductFile(
        file,
        productData.expert_id,
        product.id
      );

      // Upload thumbnail if provided
      let thumbnailUrl = null;
      if (thumbnail) {
        thumbnailUrl = await this.uploadProductThumbnail(
          thumbnail,
          productData.expert_id,
          product.id
        );
      }

      // Update product with file paths
      const updatedProduct = await this.updateProduct(product.id, {
        file_url: filePath,
        primary_file_url: filePath,
        thumbnail_url: thumbnailUrl,
      });

      return updatedProduct;
    } catch (error) {
      // If file upload fails, delete the product record
      await this.deleteProduct(product.id);
      throw error;
    }
  },

  // Update a product
  async updateProduct(productId: string, updates: Partial<Product>): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', productId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete a product (soft delete by setting is_active to false)
  async deleteProduct(productId: string): Promise<void> {
    // First, clean up all associated files from product_files table
    const { data: productFiles } = await supabase
      .from('product_files')
      .select('id, file_url')
      .eq('product_id', productId);

    if (productFiles && productFiles.length > 0) {
      // Delete storage files with proper path extraction
      const filePaths = productFiles.map(f => this.extractStoragePath(f.file_url));
      const { error: storageError } = await supabase.storage
        .from('products')
        .remove(filePaths);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
        // Continue with database deletion even if storage deletion fails
      }

      // Delete database records
      const { error: deleteFilesError } = await supabase
        .from('product_files')
        .delete()
        .eq('product_id', productId);

      if (deleteFilesError) throw deleteFilesError;
    }

    // Also handle legacy file_url in products table
    const { data: product } = await supabase
      .from('products')
      .select('file_url, thumbnail_url, expert_id')
      .eq('id', productId)
      .single();

    if (product?.file_url) {
      const legacyPath = this.extractStoragePath(product.file_url);
      const { error: legacyStorageError } = await supabase.storage
        .from('products')
        .remove([legacyPath]);

      if (legacyStorageError) {
        console.error('Legacy storage deletion error:', legacyStorageError);
      }
    }

    // Delete thumbnail if exists
    if (product?.thumbnail_url) {
      const thumbnailPath = this.extractStoragePath(product.thumbnail_url);
      const { error: thumbnailError } = await supabase.storage
        .from('product-thumbnails')
        .remove([thumbnailPath]);

      if (thumbnailError) {
        console.error('Thumbnail deletion error:', thumbnailError);
      }
    }

    // Then soft delete the product
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', productId);

    if (error) throw error;
  },

  // Upload product file
  async uploadProductFile(
    file: File,
    expertId: string,
    productId: string
  ): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${expertId}/${productId}.${fileExt}`;

    // Calculate file size in MB
    const fileSizeMB = file.size / (1024 * 1024);

    const { data, error } = await supabase.storage
      .from('products')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: true, // Allow overwriting existing files
      });

    if (error) throw error;

    // Get the public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('products')
      .getPublicUrl(fileName);

    // Store file metadata in product_files table - use relative path for consistency
    const fileType = file.type.startsWith('video/') ? 'video' :
                    file.type.startsWith('image/') ? 'image' :
                    file.type.includes('pdf') ? 'document' : 'other';

    await supabase.from('product_files').insert({
      product_id: productId,
      file_url: fileName, // Store relative path instead of full URL for easier deletion
      file_name: file.name,
      file_type: fileType,
      file_size_mb: fileSizeMB,
      mime_type: file.type,
      is_primary: true,
      sort_order: 0
    });

    // Return the public URL for frontend use
    return urlData.publicUrl;
  },

  // Upload product thumbnail
  async uploadProductThumbnail(
    file: File,
    expertId: string,
    productId: string
  ): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${expertId}/${productId}-thumb.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('product-thumbnails')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: true,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('product-thumbnails')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  },

  // Get all categories
  async getCategories(): Promise<ProductCategory[]> {
    const { data, error } = await supabase
      .from('product_categories')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  },

  // Get user's purchases
  async getUserPurchases(userId: string): Promise<Purchase[]> {
    const { data, error } = await supabase
      .from('purchases')
      .select(
        `
        *,
        product:products(*,
          expert:profiles!products_expert_id_fkey(
            id,
            first_name,
            profile_image_url
          )
        )
      `
      )
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('purchased_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Check if user has purchased a product
  async hasUserPurchased(userId: string, productId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .eq('status', 'completed')
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  },

  // Add a review
  async addReview(
    productId: string,
    userId: string,
    rating: number,
    reviewText?: string
  ): Promise<ProductReview> {
    const { data, error } = await supabase
      .from('product_reviews')
      .insert({
        product_id: productId,
        user_id: userId,
        rating,
        review_text: reviewText,
        is_verified_purchase: true,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Track product analytics event
  async trackProductEvent(
    productId: string,
    eventType: 'view' | 'preview' | 'download' | 'share',
    userId?: string
  ): Promise<void> {
    const { error } = await supabase.from('product_analytics').insert({
      product_id: productId,
      user_id: userId,
      event_type: eventType,
      session_id: crypto.randomUUID(),
    });

    if (error) throw error;
  },

  // Get expert's products
  // Note: expertId is profiles.id where account_type = 'expert'
  async getExpertProducts(expertId: string): Promise<ProductWithDetails[]> {
    // Directly query expert's products without the is_active filter
    // since experts should see all their products
    const query = supabase
      .from('products')
      .select(
        `
        *,
        expert:profiles!products_expert_id_fkey(
          id,
          first_name,
          profile_image_url
        ),
        categories:product_category_mappings(
          category:product_categories(*)
        ),
        reviews:product_reviews(rating),
        files:product_files(*)
      `
      )
      .eq('expert_id', expertId)
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    // Calculate average ratings
    const productsWithRatings = data?.map((product) => {
      const ratings = product.reviews?.map((r: { rating: number }) => r.rating).filter(Boolean) || [];
      const averageRating = ratings.length > 0
        ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length
        : null;

      return {
        ...product,
        average_rating: averageRating,
        total_reviews: ratings.length,
      };
    }) || [];

    return productsWithRatings as ProductWithDetails[];
  },

  // Get product files
  async getProductFiles(productId: string): Promise<ProductFile[]> {
    const { data, error } = await supabase
      .from('product_files')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Add file to product
  async addProductFile(
    productId: string,
    file: File,
    fileData: Partial<ProductFileInsert>
  ): Promise<ProductFile> {
    // Validate file before upload
    const validation = this.validateFile(file);
    if (!validation.isValid) {
      throw new Error(validation.error || 'File validation failed');
    }

    const fileId = crypto.randomUUID();
    const fileExt = file.name.split('.').pop() || 'bin';
    const cleanFileName = STORAGE_CONFIG.cleanFileName(file.name);
    const fileName = `${productId}/${fileId}.${fileExt}`;

    console.log(`Uploading file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB) to ${fileName}`);

    // Upload file to storage with retry logic and resumable uploads for large files
    let uploadAttempts = 0;
    const maxRetries = 3;
    let uploadError: Error | null = null;

    // Use resumable upload for files over 6MB as recommended by Supabase
    const fileSizeMB = file.size / (1024 * 1024);
    const useResumableUpload = fileSizeMB > 6;

    while (uploadAttempts < maxRetries) {
      let uploadResult;
      
      if (useResumableUpload) {
        console.log(`Using resumable upload for large file: ${file.name} (${fileSizeMB.toFixed(2)}MB)`);
        uploadResult = await supabase.storage
          .from('products')
          .createSignedUploadUrl(fileName, {
            upsert: false,
          });
        
        if (uploadResult.error) {
          uploadError = uploadResult.error;
        } else {
          // Upload using the signed URL
          try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch(uploadResult.data.signedUrl, {
              method: 'PUT',
              body: file,
              headers: {
                'Content-Type': file.type,
              },
            });
            
            if (!response.ok) {
              throw new Error(`Upload failed with status ${response.status}: ${response.statusText}`);
            }
            
            uploadError = null;
          } catch (fetchError) {
            uploadError = fetchError as Error;
          }
        }
      } else {
        // Use standard upload for smaller files
        uploadResult = await supabase.storage
          .from('products')
          .upload(fileName, file, {
            contentType: file.type,
            upsert: false,
          });
        
        uploadError = uploadResult.error;
      }

      if (!uploadError) {
        break;
      }

      uploadAttempts++;
      
      if (uploadAttempts < maxRetries) {
        console.warn(`Upload attempt ${uploadAttempts} failed for ${file.name}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * uploadAttempts));
      }
    }

    if (uploadError) {
      console.error(`Failed to upload ${file.name} after ${maxRetries} attempts:`, uploadError);
      
      // Provide more specific error messages for common issues
      let errorMessage = uploadError.message;
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
      
      if (uploadError.message.includes('exceeded the maximum allowed size') || 
          uploadError.message.includes('file size limit') ||
          uploadError.message.includes('413') ||
          uploadError.message.includes('Payload too large') ||
          (uploadError as any).status === 413) {
        errorMessage = `File "${file.name}" (${fileSizeMB}MB) exceeds storage limits. The bucket is configured for 500MB max. This may be a temporary sync issue - please try again in a few minutes.`;
      } else if (uploadError.message.includes('400') || (uploadError as any).status === 400) {
        errorMessage = `Upload failed for "${file.name}" (${fileSizeMB}MB). ${uploadError.message}. The storage bucket has been reconfigured - please try again.`;
      } else if (uploadError.message.includes('network') || uploadError.message.includes('timeout')) {
        errorMessage = `Network error uploading "${file.name}" (${fileSizeMB}MB). Please check your connection and try again.`;
      }
      
      throw new Error(errorMessage);
    }

    // Create file record with relative path for easier deletion
    const fileSizeInMB = Math.round((file.size / (1024 * 1024)) * 100) / 100; // Round to 2 decimal places
    
    const { data, error } = await supabase
      .from('product_files')
      .insert({
        product_id: productId,
        file_url: fileName, // Store relative path instead of full URL
        file_name: file.name,
        file_type: this.detectFileType(file.type),
        file_size_mb: fileSizeInMB,
        mime_type: file.type,
        display_title: fileData.display_title || file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "),
        ...fileData,
      })
      .select()
      .single();

    if (error) {
      // Cleanup uploaded file if database insert fails
      try {
        await supabase.storage.from('products').remove([fileName]);
      } catch (cleanupError) {
        console.warn('Failed to cleanup file after database error:', cleanupError);
      }
      throw error;
    }

    // Update product file count
    try {
      await this.updateProductFileCount(productId);
    } catch (countError) {
      console.warn('Failed to update product file count:', countError);
      // Don't fail the entire operation for this
    }

    console.log(`Successfully uploaded and stored file: ${file.name}`);
    return data;
  },

  // Add multiple files to product
  async addMultipleProductFiles(
    productId: string,
    files: File[],
    expertId?: string,
    titles?: string[]
  ): Promise<ProductFile[]> {
    if (!files || files.length === 0) {
      throw new Error('No files provided for upload');
    }

    const uploadedFiles: ProductFile[] = [];
    const failedFiles: { file: File; error: string }[] = [];
    
    // Validate all files before starting uploads
    for (const file of files) {
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        failedFiles.push({ file, error: validation.error || 'File validation failed' });
      }
    }
    
    if (failedFiles.length === files.length) {
      throw new Error(`All files failed validation: ${failedFiles.map(f => `${f.file.name}: ${f.error}`).join(', ')}`);
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Skip files that failed validation
      const failedFile = failedFiles.find(f => f.file === file);
      if (failedFile) {
        console.warn(`Skipping ${file.name}: ${failedFile.error}`);
        continue;
      }
      
      const fileData: Partial<ProductFileInsert> = {
        sort_order: i,
        is_primary: i === 0 && uploadedFiles.length === 0, // First successful file is primary
        display_title: titles?.[i] || file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "),
      };

      try {
        const uploadedFile = await this.addProductFile(productId, file, fileData);
        uploadedFiles.push(uploadedFile);
        
        console.log(`Successfully uploaded ${file.name}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to upload file ${file.name}:`, error);
        failedFiles.push({ file, error: errorMessage });
        
        // Continue with other files but track failures
      }
    }

    // Update product file counts after all uploads
    try {
      await this.updateProductFileCount(productId);
    } catch (error) {
      console.warn('Failed to update product file count:', error);
    }

    // If no files were uploaded successfully, throw an error
    if (uploadedFiles.length === 0) {
      const errorDetails = failedFiles.map(f => `${f.file.name}: ${f.error}`).join(', ');
      throw new Error(`Failed to upload any files. Errors: ${errorDetails}`);
    }

    // Log partial failures
    if (failedFiles.length > 0) {
      console.warn(`${failedFiles.length} files failed to upload:`, failedFiles.map(f => f.file.name));
    }

    return uploadedFiles;
  },

  // Delete product file
  async deleteProductFile(fileId: string): Promise<void> {
    // Get file info first
    const { data: file, error: fetchError } = await supabase
      .from('product_files')
      .select('file_url, product_id')
      .eq('id', fileId)
      .single();

    if (fetchError) throw fetchError;

    // Extract proper storage path
    const storagePath = this.extractStoragePath(file.file_url);

    // Delete from storage
    const { error: deleteStorageError } = await supabase.storage
      .from('products')
      .remove([storagePath]);

    if (deleteStorageError) {
      console.error('Storage deletion error:', deleteStorageError);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete database record
    const { error } = await supabase
      .from('product_files')
      .delete()
      .eq('id', fileId);

    if (error) throw error;

    // Update product file count
    await this.updateProductFileCount(file.product_id);
  },

  // Reorder product files
  async reorderProductFiles(
    productId: string,
    fileOrders: { id: string; sort_order: number }[]
  ): Promise<void> {
    for (const order of fileOrders) {
      const { error } = await supabase
        .from('product_files')
        .update({ sort_order: order.sort_order })
        .eq('id', order.id)
        .eq('product_id', productId);

      if (error) throw error;
    }
  },

  // Set primary file
  async setPrimaryFile(productId: string, fileId: string): Promise<void> {
    // Remove primary flag from all files
    const { error: resetError } = await supabase
      .from('product_files')
      .update({ is_primary: false })
      .eq('product_id', productId);

    if (resetError) throw resetError;

    // Set new primary file
    const { error } = await supabase
      .from('product_files')
      .update({ is_primary: true })
      .eq('id', fileId);

    if (error) throw error;

    // Update product's primary_file_url
    const { data: file } = await supabase
      .from('product_files')
      .select('file_url')
      .eq('id', fileId)
      .single();

    if (file) {
      await this.updateProduct(productId, {
        primary_file_url: file.file_url,
      });
    }
  },

  // Helper: Extract storage path from file URL
  extractStoragePath(fileUrl: string): string {
    // Handle full URLs (e.g., https://...supabase.co/storage/v1/object/public/products/path)
    if (fileUrl.includes('/storage/v1/object/public/products/')) {
      const parts = fileUrl.split('/storage/v1/object/public/products/');
      return parts[1] || fileUrl;
    }
    
    // Handle relative paths that start with 'products/'
    if (fileUrl.startsWith('products/')) {
      return fileUrl.substring('products/'.length);
    }
    
    // Return as-is if it's already a proper storage path
    return fileUrl;
  },

  // Helper: Get public URL for a file path
  getPublicFileUrl(filePath: string): string {
    // If it's already a full URL, return as-is
    if (filePath.startsWith('http')) {
      return filePath;
    }
    
    // If path is empty or invalid, return empty string
    if (!filePath || filePath.trim() === '') {
      console.warn('Empty file path provided to getPublicFileUrl');
      return '';
    }
    
    // Handle paths that already include the bucket name
    let storagePath = filePath;
    if (filePath.startsWith('products/')) {
      storagePath = filePath.substring('products/'.length);
    }
    
    // Ensure we have a valid storage path
    if (!storagePath || storagePath.trim() === '') {
      console.error('Invalid storage path after processing:', filePath);
      return '';
    }
    
    try {
      // Generate public URL from storage path
      const { data } = supabase.storage
        .from('products')
        .getPublicUrl(storagePath);
      
      return data.publicUrl;
    } catch (error) {
      console.error('Error generating public URL for path:', storagePath, error);
      return '';
    }
  },

  // Helper: Detect file type from MIME type
  detectFileType(mimeType: string): 'video' | 'document' | 'audio' | 'image' | 'other' {
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('image/')) return 'image';
    if (
      mimeType.includes('pdf') ||
      mimeType.includes('document') ||
      mimeType.includes('text') ||
      mimeType.includes('sheet') ||
      mimeType.includes('presentation')
    ) return 'document';
    return 'other';
  },

  // Helper: Validate file before upload
  validateFile(file: File): { isValid: boolean; error?: string } {
    // Use centralized validation from upload config
    const result = validateFileUpload(file);
    if (!result.isValid) {
      return result;
    }

    // Check minimum file size (1KB)
    if (file.size < 1024) {
      return { isValid: false, error: 'File too small (minimum 1KB)' };
    }

    return { isValid: true };
  },

  // Helper: Clean file name for storage
  cleanFileName(fileName: string): string {
    return STORAGE_CONFIG.cleanFileName(fileName);
  },

  // Helper: Get file path for storage
  getStorageFilePath(expertId: string, productId: string, fileId: string, fileName: string): string {
    return STORAGE_CONFIG.getFilePath(expertId, productId, fileId, this.cleanFileName(fileName));
  },

  // Helper: Update product file count
  async updateProductFileCount(productId: string): Promise<void> {
    const { count, error: countError } = await supabase
      .from('product_files')
      .select('*', { count: 'exact' })
      .eq('product_id', productId);

    if (countError) throw countError;

    const { error } = await supabase
      .from('products')
      .update({
        has_multiple_files: (count || 0) > 1,
        total_files_count: count || 0,
      })
      .eq('id', productId);

    if (error) throw error;
  },

  // Create product with multiple files
  async createProductWithMultipleFiles(
    productData: {
      title: string;
      description: string;
      price: number;
      product_type: 'video' | 'document' | 'mixed';
      expert_id: string;
      content_type?: 'single' | 'bundle' | 'course' | 'collection';
    },
    files: File[],
    titles?: string[],
    thumbnail?: File
  ): Promise<Product> {
    if (!files || files.length === 0) {
      throw new Error('At least one file is required');
    }

    // Validate all files before starting
    const validationResults = files.map((file, index) => ({
      file,
      index,
      validation: this.validateFile(file)
    }));

    const invalidFiles = validationResults.filter(r => !r.validation.isValid);
    if (invalidFiles.length > 0) {
      const errors = invalidFiles.map(f => `${f.file.name}: ${f.validation.error}`).join(', ');
      throw new Error(`File validation failed: ${errors}`);
    }

    // Create product record first with optimistic file count
    const product = await this.createProduct({
      title: productData.title,
      description: productData.description,
      price: productData.price,
      product_type: productData.product_type as 'video' | 'document' | 'audio' | 'course' | 'consultation',
      expert_id: productData.expert_id,
      content_type: productData.content_type || (files.length > 1 ? 'bundle' : 'single'),
      is_active: false, // Keep inactive until all files are uploaded
      has_multiple_files: files.length > 1,
      total_files_count: files.length,
    } as ProductInsert);

    const uploadedFiles: ProductFile[] = [];
    let thumbnailUrl: string | null = null;

    try {
      // Upload thumbnail first if provided (smaller, faster)
      if (thumbnail) {
        try {
          thumbnailUrl = await this.uploadProductThumbnail(
            thumbnail,
            productData.expert_id,
            product.id
          );
          console.log('Thumbnail uploaded successfully');
        } catch (error) {
          console.warn('Thumbnail upload failed, continuing with files:', error);
        }
      }

      // Upload all files with enhanced error handling
      const uploadResults = await this.addMultipleProductFiles(
        product.id,
        files,
        productData.expert_id,
        titles
      );

      uploadedFiles.push(...uploadResults);

      // Ensure we have at least one successful upload
      if (uploadedFiles.length === 0) {
        throw new Error('No files were successfully uploaded');
      }

      // Set primary file URL
      const primaryFile = uploadedFiles.find(f => f.is_primary) || uploadedFiles[0];
      
      // Update product with final details and activate it
      const updateData: Partial<Product> = {
        primary_file_url: primaryFile.file_url,
        file_url: primaryFile.file_url, // For backward compatibility
        is_active: true, // Activate the product now that files are uploaded
        has_multiple_files: uploadedFiles.length > 1,
        total_files_count: uploadedFiles.length,
      };

      if (thumbnailUrl) {
        updateData.thumbnail_url = thumbnailUrl;
      }

      await this.updateProduct(product.id, updateData);

      console.log(`Successfully created product ${product.id} with ${uploadedFiles.length} files`);

      return {
        ...product,
        ...updateData
      } as Product;

    } catch (error) {
      console.error('Error during product creation, cleaning up:', error);
      
      // Clean up: delete any uploaded files and the product record
      try {
        // Delete uploaded files from storage
        for (const uploadedFile of uploadedFiles) {
          try {
            await this.deleteProductFile(uploadedFile.id);
          } catch (cleanupError) {
            console.warn(`Failed to cleanup file ${uploadedFile.id}:`, cleanupError);
          }
        }

        // Delete the product record
        await supabase.from('products').delete().eq('id', product.id);
        
        // Delete thumbnail if it was uploaded
        if (thumbnailUrl) {
          try {
            const thumbnailPath = this.extractStoragePath(thumbnailUrl);
            await supabase.storage.from('product-thumbnails').remove([thumbnailPath]);
          } catch (thumbnailCleanupError) {
            console.warn('Failed to cleanup thumbnail:', thumbnailCleanupError);
          }
        }

      } catch (cleanupError) {
        console.error('Failed to cleanup after error:', cleanupError);
      }

      // Re-throw the original error
      throw new Error(`Product creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  // Get expert's sales analytics
  // Note: expertId is profiles.id where account_type = 'expert'
  async getExpertSalesAnalytics(expertId: string): Promise<{
    totalRevenue: number;
    totalSales: number;
    productsCount: number;
    topProducts: ProductWithDetails[];
  }> {
    // Get sales data
    const { data: sales, error: salesError } = await supabase
      .from('purchases')
      .select('amount, product_id')
      .eq('expert_id', expertId)
      .eq('status', 'completed');

    if (salesError) throw salesError;

    // Get products count
    const { count: productsCount, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('expert_id', expertId)
      .eq('is_active', true);

    if (countError) throw countError;

    // Calculate totals
    const totalRevenue = sales?.reduce((sum, sale) => sum + (sale.amount || 0), 0) || 0;
    const totalSales = sales?.length || 0;

    // Get top products
    const productSales = sales?.reduce((acc, sale) => {
      if (sale.product_id) {
        acc[sale.product_id] = (acc[sale.product_id] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>) || {};

    const topProductIds = Object.entries(productSales)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => id);

    const topProducts: ProductWithDetails[] = [];
    for (const productId of topProductIds) {
      const product = await this.getProduct(productId);
      if (product) topProducts.push(product);
    }

    return {
      totalRevenue,
      totalSales,
      productsCount: productsCount || 0,
      topProducts,
    };
  },
};