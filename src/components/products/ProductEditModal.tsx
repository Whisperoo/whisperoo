import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Upload,
  FileText,
  Video,
  Image,
  Loader2,
  X,
  Download,
  Star,
  Plus,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { productService, ProductWithDetails } from "@/services/products";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MultiFileUploader } from "./MultiFileUploader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Database } from "@/types/database.types";
import { getCurrentLimits } from "@/config/upload";

type ProductFile = Database["public"]["Tables"]["product_files"]["Row"];

const productSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().min(10, "Description must be at least 10 characters"),
  price: z.number().min(0, "Price must be 0 or greater"),
  productType: z.enum(["video", "document", "audio", "course", "consultation"]),
  contentType: z.enum(["single", "bundle", "course", "collection"]),
  categoryIds: z.array(z.string()),
  durationMinutes: z.number().optional(),
  pageCount: z.number().optional(),
  isActive: z.boolean(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductEditModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product: ProductWithDetails;
}

export const ProductEditModal: React.FC<ProductEditModalProps> = ({
  open,
  onClose,
  onSuccess,
  product,
}) => {
  const { user } = useAuth();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [fileProgress, setFileProgress] = useState<
    Record<number, { fileName: string; progress: number }>
  >({});

  // Get current upload limits
  const limits = getCurrentLimits();
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<ProductFile[]>([]);
  const [filesToDelete, setFilesToDelete] = useState<string[]>([]);
  const [newThumbnailFile, setNewThumbnailFile] = useState<File | null>(null);
  const [fileManagementMode, setFileManagementMode] = useState<
    "replace" | "add" | "manage"
  >("manage");

  const { data: categories } = useQuery({
    queryKey: ["product-categories"],
    queryFn: () => productService.getCategories(),
  });

  // Initialize existing files from product
  // useEffect(() => {
  //   if (product && product.files) {
  //     setExistingFiles(product.files);
  //   }
  // }, [product]);
  // In the initialization useEffect:
  useEffect(() => {
    if (product && product.files) {
      // Sort files by sort_order before setting state
      const sortedFiles = [...product.files].sort(
        (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
      );
      setExistingFiles(sortedFiles);
    }
  }, [product]);

  // Get existing category IDs
  const existingCategoryIds =
    product.categories
      ?.map((c) =>
        typeof c === "object" && "category" in c
          ? (c.category as any)?.id
          : (c as any).id,
      )
      .filter(Boolean) || [];

  // Determine content type based on files
  const determineContentType = (
    filesCount: number,
  ): "single" | "bundle" | "course" | "collection" => {
    if (filesCount <= 1) return "single";
    return (
      (product.content_type as "single" | "bundle" | "course" | "collection") ||
      "bundle"
    );
  };

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      title: product.title || "",
      description: product.description || "",
      price: product.price || 0,
      productType: (product.product_type || "document") as any,
      contentType: determineContentType(
        (product.files?.length || 0) + (product.file_url ? 1 : 0),
      ),
      categoryIds: existingCategoryIds,
      durationMinutes: product.duration_minutes || undefined,
      pageCount: product.page_count || undefined,
      isActive: product.is_active !== false,
    },
  });

  useEffect(() => {
    // Reset form when product changes
    if (product) {
      const categoryIds =
        product.categories
          ?.map((c) =>
            typeof c === "object" && "category" in c
              ? (c.category as any)?.id
              : (c as any).id,
          )
          .filter(Boolean) || [];

      const filesCount =
        (product.files?.length || 0) + (product.file_url ? 1 : 0);

      form.reset({
        title: product.title || "",
        description: product.description || "",
        price: product.price || 0,
        productType: (product.product_type || "document") as any,
        contentType: determineContentType(filesCount),
        categoryIds: categoryIds,
        durationMinutes: product.duration_minutes || undefined,
        pageCount: product.page_count || undefined,
        isActive: product.is_active !== false,
      });
    }
  }, [product, form]);

  const handleNewFilesChange = (
    filesWithTitles: { file: File; displayTitle: string }[],
  ) => {
    // Extract the File objects from FileWithTitle wrapper objects
    const files = filesWithTitles.map((ft) => ft.file);
    setNewFiles(files);

    // Auto-detect content type based on file count
    const totalFiles =
      existingFiles.filter((f) => !filesToDelete.includes(f.id)).length +
      files.length;
    if (totalFiles > 1) {
      form.setValue("contentType", "bundle");
    } else {
      form.setValue("contentType", "single");
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewThumbnailFile(file);
    }
  };

  const markFileForDeletion = (fileId: string) => {
    setFilesToDelete((prev) => [...prev, fileId]);
    setExistingFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const setPrimaryFile = async (fileId: string) => {
    setExistingFiles((prev) =>
      prev.map((f) => ({
        ...f,
        is_primary: f.id === fileId,
      })),
    );
  };

  const updateExistingFileTitle = (fileId: string, title: string) => {
    setExistingFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, display_title: title } : f)),
    );
  };

  // const moveExistingFile = (index: number, direction: "up" | "down") => {
  //   setExistingFiles((prev) => {
  //     const newFiles = [...prev];
  //     const targetIndex = direction === "up" ? index - 1 : index + 1;

  //     if (targetIndex < 0 || targetIndex >= newFiles.length) {
  //       return prev;
  //     }

  //     // Swap files
  //     [newFiles[index], newFiles[targetIndex]] = [
  //       newFiles[targetIndex],
  //       newFiles[index],
  //     ];

  //     // Update sort_order for both files
  //     newFiles[index] = { ...newFiles[index], sort_order: index };
  //     newFiles[targetIndex] = {
  //       ...newFiles[targetIndex],
  //       sort_order: targetIndex,
  //     };

  //     return newFiles;
  //   });
  // };
  const moveExistingFile = (index: number, direction: "up" | "down") => {
    setExistingFiles((prev) => {
      const newFiles = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= newFiles.length) {
        return prev;
      }

      // Swap the sort_order values instead of using array indices
      const tempSortOrder = newFiles[index].sort_order;
      newFiles[index].sort_order = newFiles[targetIndex].sort_order;
      newFiles[targetIndex].sort_order = tempSortOrder;

      // Then swap the array positions
      [newFiles[index], newFiles[targetIndex]] = [
        newFiles[targetIndex],
        newFiles[index],
      ];

      return newFiles;
    });
  };
  useEffect(() => {
    console.log(
      "existingFiles changed:",
      existingFiles.map((f) => ({
        id: f.id,
        sort_order: f.sort_order,
        display_title: f.display_title,
      })),
    );
  }, [existingFiles]);
  const getFileIcon = (fileType: string) => {
    if (fileType.includes("video")) return <Video className="w-4 h-4" />;
    if (fileType.includes("image")) return <Image className="w-4 h-4" />;
    if (fileType.includes("pdf") || fileType.includes("document"))
      return <FileText className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const formatFileSize = (mb: number | null) => {
    if (!mb) return "Unknown size";
    if (mb < 1) return `${(mb * 1024).toFixed(0)} KB`;
    return `${mb.toFixed(2)} MB`;
  };

  const onSubmit = async (data: ProductFormData) => {
    if (!user || !product) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      setUploadProgress(20);

      // Update basic product information
      const updateData: any = {
        title: data.title,
        description: data.description,
        price: data.price,
        product_type: data.productType,
        content_type: data.contentType,
        is_active: data.isActive,
        has_multiple_files:
          existingFiles.length + newFiles.length - filesToDelete.length > 1,
        total_files_count:
          existingFiles.length + newFiles.length - filesToDelete.length,
      };

      if (data.productType === "video" && data.durationMinutes) {
        updateData.duration_minutes = data.durationMinutes;
      }

      if (data.productType === "document" && data.pageCount) {
        updateData.page_count = data.pageCount;
      }

      setUploadProgress(40);

      // Handle file deletions
      if (filesToDelete.length > 0) {
        for (const fileId of filesToDelete) {
          await productService.deleteProductFile(fileId);
        }
      }

      setUploadProgress(50);
      setFileProgress({}); // Reset file progress

      // Progress callback for individual files
      const handleFileProgress = (
        fileIndex: number,
        fileName: string,
        progress: number,
      ) => {
        setFileProgress((prev) => {
          const updated = {
            ...prev,
            [fileIndex]: { fileName, progress },
          };

          // Calculate overall progress based on file progress
          const totalFiles = newFiles.length;
          const completedCount = Object.values(updated).filter(
            (f) => f.progress === 100,
          ).length;
          const overallProgress =
            50 + Math.floor((completedCount / totalFiles) * 10);
          setUploadProgress(overallProgress);

          return updated;
        });
      };

      // Upload new files
      if (newFiles.length > 0) {
        const uploadedFiles = await productService.addMultipleProductFiles(
          product.id,
          newFiles,
          product.expert_id || user.id,
          undefined, // titles
          handleFileProgress, // Pass progress callback
        );

        // If this is the first file or no primary file exists, set the first as primary
        const hasPrimaryFile = existingFiles.some(
          (f) => f.is_primary && !filesToDelete.includes(f.id),
        );
        if (!hasPrimaryFile && uploadedFiles.length > 0) {
          await productService.setPrimaryFile(product.id, uploadedFiles[0].id);
          updateData.primary_file_url = uploadedFiles[0].file_url;
        }
      }

      setUploadProgress(60);

      // Handle primary file selection for existing files
      const primaryFile = existingFiles.find(
        (f) => f.is_primary && !filesToDelete.includes(f.id),
      );
      if (primaryFile) {
        await productService.setPrimaryFile(product.id, primaryFile.id);
        updateData.primary_file_url = primaryFile.file_url;
      }

      // Upload new thumbnail if provided
      if (newThumbnailFile) {
        setUploadProgress(70);
        const thumbnailUrl = await productService.uploadProductThumbnail(
          newThumbnailFile,
          product.expert_id || user.id,
          product.id,
        );
        updateData.thumbnail_url = thumbnailUrl;
      }

      setUploadProgress(80);

      // Update the product
      await productService.updateProduct(product.id, updateData);

      setUploadProgress(90);

      // Update display titles and sort order for existing files
      // for (let i = 0; i < existingFiles.length; i++) {
      //   const file = existingFiles[i];
      //   if (!filesToDelete.includes(file.id)) {
      //     await supabase
      //       .from('product_files')
      //       .update({
      //         display_title: file.display_title,
      //         sort_order: i
      //       })
      //       .eq('id', file.id);
      //   }
      // }
      for (const file of existingFiles) {
        if (!filesToDelete.includes(file.id)) {
          await supabase
            .from("product_files")
            .update({
              display_title: file.display_title,
              sort_order: file.sort_order, // keep the original order
            })
            .eq("id", file.id);
        }
      }

      // Update category mappings
      // First, delete existing mappings
      await supabase
        .from("product_category_mappings")
        .delete()
        .eq("product_id", product.id);

      // Then add new mappings
      if (data.categoryIds.length > 0) {
        const categoryMappings = data.categoryIds.map((categoryId) => ({
          product_id: product.id,
          category_id: categoryId,
        }));

        await supabase
          .from("product_category_mappings")
          .insert(categoryMappings);
      }

      setUploadProgress(100);

      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 500);
    } catch (error) {
      console.error("Update error:", error);
      alert(
        `Failed to update product: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setFileProgress({}); // Reset file progress
    }
  };

  const handleClose = () => {
    form.reset();
    setNewFiles([]);
    setExistingFiles([]);
    setFilesToDelete([]);
    setNewThumbnailFile(null);
    setUploadProgress(0);
    setFileProgress({}); // Reset file progress
    setFileManagementMode("manage");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <div className="sticky top-0 z-10 px-4 py-3 border-b bg-white/95 backdrop-blur-sm">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-4">
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Edit Product
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600 mt-1">
                Update your product details and manage files.
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="flex-shrink-0 h-8 w-8 rounded-full hover:bg-gray-100"
              aria-label="Close edit modal"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-4">
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
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value))
                          }
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
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="document">Document</SelectItem>
                          <SelectItem value="video">Video</SelectItem>
                          <SelectItem value="audio">Audio</SelectItem>
                          <SelectItem value="course">Course</SelectItem>
                          <SelectItem value="consultation">
                            Consultation
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Content Type for Multiple Files */}
              {existingFiles.length + newFiles.length - filesToDelete.length >
                1 && (
                <FormField
                  control={form.control}
                  name="contentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content Organization</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select content type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bundle">
                            Bundle (Related files)
                          </SelectItem>
                          <SelectItem value="course">
                            Course (Structured learning)
                          </SelectItem>
                          <SelectItem value="collection">
                            Collection (Curated set)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Additional fields based on type */}
              {form.watch("productType") === "video" && (
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
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {form.watch("productType") === "document" && (
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
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Active Status */}
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Product is Active</FormLabel>
                      <FormDescription>
                        Inactive products won't be visible to customers
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {/* Categories */}
              <FormField
                control={form.control}
                name="categoryIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categories</FormLabel>
                    <div className="grid grid-cols-2 gap-3">
                      {categories?.map((category) => (
                        <div
                          key={category.id}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            checked={field.value?.includes(category.id)}
                            onCheckedChange={(checked) => {
                              const updatedValue = checked
                                ? [...(field.value || []), category.id]
                                : field.value?.filter(
                                    (id) => id !== category.id,
                                  ) || [];
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

              {/* File Management Section */}
              <div className="space-y-4">
                <div>
                  <FormLabel>Product Files</FormLabel>
                  <FormDescription>
                    Manage existing files and add new ones
                  </FormDescription>
                </div>

                {/* Existing Files */}
                {existingFiles.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-medium">Current Files</h4>
                        {existingFiles.length > 1 && (
                          <p className="text-xs text-gray-500">
                            Use arrows to reorder files
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        {existingFiles.map((file, index) => (
                          <div
                            key={file.id}
                            className="p-3 border rounded space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3 flex-1">
                                <div
                                  className={cn(
                                    "p-2 rounded",
                                    file.file_type === "video"
                                      ? "bg-action-primary"
                                      : file.file_type === "document"
                                        ? "bg-orange-100"
                                        : "bg-gray-100",
                                  )}
                                >
                                  {getFileIcon(file.file_type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-muted-foreground truncate">
                                    {file.file_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatFileSize(file.file_size_mb)}
                                    {file.is_primary && (
                                      <Badge
                                        variant="default"
                                        className="ml-2 text-xs"
                                      >
                                        Primary
                                      </Badge>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1">
                                {/* Reorder Buttons */}
                                {existingFiles.length > 1 && (
                                  <>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        moveExistingFile(index, "up")
                                      }
                                      disabled={index === 0}
                                      className="p-1"
                                    >
                                      <ChevronUp className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        moveExistingFile(index, "down")
                                      }
                                      disabled={
                                        index === existingFiles.length - 1
                                      }
                                      className="p-1"
                                    >
                                      <ChevronDown className="w-4 h-4" />
                                    </Button>
                                  </>
                                )}
                                {/* Primary Star */}
                                {!file.is_primary &&
                                  existingFiles.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setPrimaryFile(file.id)}
                                      className={cn("p-1")}
                                    >
                                      <Star className="w-4 h-4" />
                                    </Button>
                                  )}
                                {file.is_primary &&
                                  existingFiles.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      disabled
                                      className="p-1 text-yellow-500"
                                    >
                                      <Star className="w-4 h-4 fill-current" />
                                    </Button>
                                  )}
                                {/* Delete Button */}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => markFileForDeletion(file.id)}
                                  className="p-1 text-red-500 hover:text-red-700"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>

                            {/* Editable Display Title */}
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-gray-700">
                                Display Title
                              </label>
                              <Input
                                value={file.display_title || ""}
                                onChange={(e) =>
                                  updateExistingFileTitle(
                                    file.id,
                                    e.target.value,
                                  )
                                }
                                placeholder="Enter display title..."
                                className="text-sm"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      {filesToDelete.length > 0 && (
                        <p className="text-xs text-red-500 mt-2">
                          {filesToDelete.length} file(s) will be deleted
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Add New Files */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Add New Files</h4>
                  <MultiFileUploader
                    onFilesChange={handleNewFilesChange}
                    maxFiles={limits.maxFiles}
                    acceptedFileTypes={[
                      "video/*",
                      "application/pdf",
                      "image/*",
                      "audio/*",
                    ]}
                    existingFilesCount={
                      existingFiles.filter((f) => !filesToDelete.includes(f.id))
                        .length
                    }
                    hasPrimaryFile={existingFiles.some(
                      (f) => f.is_primary && !filesToDelete.includes(f.id),
                    )}
                  />
                </div>

                {/* Thumbnail Upload */}
                <div>
                  <FormLabel>Thumbnail Image</FormLabel>
                  <div className="mt-2">
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {newThumbnailFile ? (
                          <>
                            <Image className="w-6 h-6 mb-1 text-muted-foreground" />
                            <p className="text-sm">{newThumbnailFile.name}</p>
                          </>
                        ) : (
                          <>
                            <Image className="w-6 h-6 mb-1 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              Click to upload new thumbnail
                            </p>
                          </>
                        )}
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleThumbnailChange}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Upload Progress */}
              {isUploading && (
                <div className="space-y-3">
                  {/* Overall Progress */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Overall Progress
                      </span>
                      <span className="font-medium">{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="w-full h-2" />
                  </div>

                  {/* Individual File Progress */}
                  {Object.keys(fileProgress).length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      <p className="text-xs font-medium text-muted-foreground">
                        Uploading files:
                      </p>
                      {Object.entries(fileProgress).map(
                        ([index, { fileName, progress }]) => (
                          <div key={index} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground truncate flex-1 mr-2">
                                {fileName}
                              </span>
                              <span className="font-medium flex-shrink-0">
                                {progress === -1
                                  ? "❌ Error"
                                  : progress === 100
                                    ? "✓"
                                    : `${progress}%`}
                              </span>
                            </div>
                            {progress !== -1 && (
                              <Progress
                                value={progress}
                                className={`w-full h-1 ${progress === 100 ? "bg-green-100" : ""}`}
                              />
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isUploading}>
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Product"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
