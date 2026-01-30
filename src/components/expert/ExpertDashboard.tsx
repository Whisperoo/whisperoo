import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Download,
  DollarSign,
  Package,
  TrendingUp,
  Users,
  Settings,
  Calendar,
  CheckCircle,
  Clock,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productService, ProductWithDetails } from "@/services/products";
import { ProductUploadModal } from "@/components/products/ProductUploadModal";
import { ProductEditModal } from "@/components/products/ProductEditModal";
import { ContentViewer } from "@/components/content/ContentViewer";
import { formatCurrency } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export const ExpertDashboard: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] =
    useState<ProductWithDetails | null>(null);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);

  // Fetch expert's products using profile.id as expertId
  // Note: For experts, profile.id serves as both user ID and expert ID
  const {
    data: products,
    isLoading: productsLoading,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ["expert-products", profile?.id],
    queryFn: () =>
      profile ? productService.getExpertProducts(profile.id) : [],
    enabled: !!profile,
  });

  // Fetch expert's sales analytics using profile.id as expertId
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["expert-analytics", profile?.id],
    queryFn: () =>
      profile ? productService.getExpertSalesAnalytics(profile.id) : null,
    enabled: !!profile,
  });

  // Fetch expert's consultation bookings
  const {
    data: consultations,
    isLoading: consultationsLoading,
    refetch: refetchConsultations,
  } = useQuery({
    queryKey: ["expert-consultations", profile?.id],
    queryFn: async () => {
      if (!profile) return [];

      const { data, error } = await supabase
        .from("purchases")
        .select(
          `
          id,
          user_id,
          amount,
          purchased_at,
          consultation_completed,
          consultation_completed_at,
          product:products!inner (
            id,
            title,
            product_type
          ),
          user:profiles!purchases_user_id_fkey (
            id,
            first_name,
            email,
            profile_image_url
          )
        `,
        )
        .eq("expert_id", profile.id)
        .eq("product.product_type", "consultation")
        .eq("status", "completed")
        .order("purchased_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile,
  });

  const queryClient = useQueryClient();

  // Mutation to mark consultation as completed
  const markConsultationComplete = useMutation({
    mutationFn: async (consultationId: string) => {
      const { data, error } = await supabase
        .from("purchases")
        .update({
          consultation_completed: true,
          consultation_completed_at: new Date().toISOString(),
        })
        .eq("id", consultationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refetchConsultations();
      queryClient.invalidateQueries({ queryKey: ["purchases"] }); // Refresh user's purchases too
    },
    onError: (error) => {
      console.error("Error marking consultation as complete:", error);
      alert("Failed to mark consultation as complete. Please try again.");
    },
  });

  const handleProductUploadSuccess = () => {
    refetchProducts();
  };

  const handleEditProduct = (product: ProductWithDetails) => {
    setSelectedProduct(product);
    setEditModalOpen(true);
  };

  const handleProductEditSuccess = () => {
    refetchProducts();
    setEditModalOpen(false);
    setSelectedProduct(null);
  };

  const handleToggleActive = async (productId: string, isActive: boolean) => {
    try {
      await productService.updateProduct(productId, { is_active: !isActive });
      refetchProducts();
    } catch (error) {
      console.error("Error toggling product status:", error);
    }
  };

  const handleViewProduct = (product: ProductWithDetails) => {
    setSelectedProduct(product);
    setPreviewModalOpen(true);
  };

  const handleClosePreview = () => {
    setPreviewModalOpen(false);
    setSelectedProduct(null);

    // Force cleanup of any lingering modal styles that may block interactions
    // This is especially important in production builds
    setTimeout(() => {
      document.body.style.pointerEvents = "";
      document.body.style.overflow = "";
    }, 100);
  };

  const handleDeleteProduct = (productId: string) => {
    setDeleteProductId(productId);
  };

  const confirmDeleteProduct = async () => {
    if (!deleteProductId) return;

    try {
      await productService.deleteProductPermanently(deleteProductId);
      refetchProducts();
      setDeleteProductId(null);
    } catch (error) {
      console.error("Error deleting product:", error);
      alert("Failed to delete product. Please try again.");
    }
  };

  if (!profile || profile.account_type !== "expert") {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              This dashboard is only available for expert accounts.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Expert Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your products and track your performance
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => navigate("/expert-settings")}
            className="gap-2 w-full sm:w-auto"
            size="sm"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Edit Profile</span>
            <span className="sm:hidden">Profile</span>
          </Button>
          <Button
            onClick={() => setUploadModalOpen(true)}
            className="gap-2 w-full sm:w-auto"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Upload Product</span>
            <span className="sm:hidden">Upload</span>
          </Button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </span>
            </div>
            <div className="text-2xl font-bold">
              {analyticsLoading
                ? "..."
                : formatCurrency(analytics?.totalRevenue || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-muted-foreground">
                Total Sales
              </span>
            </div>
            <div className="text-2xl font-bold">
              {analyticsLoading ? "..." : analytics?.totalSales || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-action-primary" />
              <span className="text-sm font-medium text-muted-foreground">
                Products
              </span>
            </div>
            <div className="text-2xl font-bold">
              {analyticsLoading ? "..." : analytics?.productsCount || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium text-muted-foreground">
                Avg Rating
              </span>
            </div>
            <div className="text-2xl font-bold">
              {profile.expert_rating ? profile.expert_rating.toFixed(1) : "N/A"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="products" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="products" className="text-xs sm:text-sm">
            Products
          </TabsTrigger>
          <TabsTrigger value="consultations" className="text-xs sm:text-sm">
            Consultations
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs sm:text-sm">
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Products</CardTitle>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="text-center py-6">Loading products...</div>
              ) : products && products.length > 0 ? (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[200px]">
                            Product
                          </TableHead>
                          <TableHead className="min-w-[100px]">Type</TableHead>
                          <TableHead className="min-w-[80px]">Price</TableHead>
                          <TableHead className="min-w-[80px]">Status</TableHead>
                          <TableHead className="min-w-[60px]">Views</TableHead>
                          <TableHead className="min-w-[80px]">Rating</TableHead>
                          <TableHead className="text-right min-w-[80px]">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {product.thumbnail_url && (
                                  <img
                                    src={product.thumbnail_url}
                                    alt={product.title}
                                    className="w-10 h-10 object-cover rounded"
                                  />
                                )}
                                <div>
                                  <div className="font-medium">
                                    {product.title}
                                  </div>
                                  <div className="text-sm text-muted-foreground line-clamp-1">
                                    {product.description}
                                  </div>
                                  {(product.files?.length ||
                                    (product.file_url ? 1 : 0)) > 0 && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {product.files?.length || 1} file
                                      {(product.files?.length || 1) > 1
                                        ? "s"
                                        : ""}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="capitalize">
                                  {product.product_type}
                                </Badge>
                                {product.has_multiple_files && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    Multi-file
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {formatCurrency(product.price)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  product.is_active ? "default" : "secondary"
                                }
                              >
                                {product.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>{product.view_count || 0}</TableCell>
                            <TableCell>
                              {product.average_rating ? (
                                <div className="flex items-center gap-1">
                                  <span>
                                    {product.average_rating.toFixed(1)}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    ({product.total_reviews})
                                  </span>
                                </div>
                              ) : (
                                "No reviews"
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => handleViewProduct(product)}
                                  >
                                    <Eye className="mr-2 h-4 w-4" />
                                    Preview Content
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleEditProduct(product)}
                                  >
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleToggleActive(
                                        product.id,
                                        product.is_active || false,
                                      )
                                    }
                                  >
                                    {product.is_active
                                      ? "Deactivate"
                                      : "Activate"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleDeleteProduct(product.id)
                                    }
                                    className="text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* DESKTOP: Original table (hidden on mobile) */}

                  {/* MOBILE: Card layout (hidden on desktop) */}
                  <div className="lg:hidden space-y-4">
                    {products.map((product) => (
                      <div
                        key={product.id}
                        className="border rounded-lg p-4 bg-card shadow-sm"
                      >
                        {/* Product Header */}
                        <div className="flex items-start gap-3 mb-3">
                          {product.thumbnail_url && (
                            <img
                              src={product.thumbnail_url}
                              alt={product.title}
                              className="w-12 h-12 object-cover rounded flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm truncate">
                              {product.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {product.product_type}
                              </Badge>
                              <Badge
                                variant={
                                  product.is_active ? "default" : "secondary"
                                }
                                className="text-xs"
                              >
                                {product.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Product Info Grid */}
                        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                          <div>
                            <p className="text-muted-foreground text-xs">
                              Price
                            </p>
                            <p className="font-medium mt-1">
                              {formatCurrency(product.price)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">
                              Views
                            </p>
                            <p className="font-medium mt-1">
                              {product.view_count || 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">
                              Rating
                            </p>
                            <p className="font-medium mt-1">
                              {product.average_rating
                                ? `${product.average_rating.toFixed(1)} (${product.total_reviews})`
                                : "No reviews"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">
                              Files
                            </p>
                            <p className="font-medium mt-1">
                              {product.files?.length ||
                                (product.file_url ? 1 : 0)}
                            </p>
                          </div>
                        </div>

                        {/* Mobile Action Buttons */}
                        <div className="flex gap-2 pt-3 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleViewProduct(product)}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                            <span className="text-xs">Preview</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleEditProduct(product)}
                          >
                            <Edit className="h-3.5 w-3.5 mr-1.5" />
                            <span className="text-xs">Edit</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleToggleActive(
                                product.id,
                                product.is_active || false,
                              )
                            }
                          >
                            <span className="text-xs">
                              {product.is_active ? "Deactivate" : "Activate"}
                            </span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-semibold">No products</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Get started by uploading your first product.
                  </p>
                  <div className="mt-6">
                    <Button
                      onClick={() => setUploadModalOpen(true)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Upload Product
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consultations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Consultation Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              {consultationsLoading ? (
                <div className="text-center py-6">Loading consultations...</div>
              ) : consultations && consultations.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px]">Client</TableHead>
                        <TableHead className="min-w-[120px]">
                          Consultation
                        </TableHead>
                        <TableHead className="min-w-[80px]">Amount</TableHead>
                        <TableHead className="min-w-[100px]">
                          Booked Date
                        </TableHead>
                        <TableHead className="min-w-[100px]">Status</TableHead>
                        <TableHead className="text-right min-w-[100px]">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {consultations.map((consultation) => (
                        <TableRow key={consultation.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {(consultation as any).user
                                ?.profile_image_url && (
                                <img
                                  src={
                                    (consultation as any).user.profile_image_url
                                  }
                                  alt={
                                    (consultation as any).user.first_name ||
                                    "Client"
                                  }
                                  className="w-8 h-8 object-cover rounded-full"
                                />
                              )}
                              <div>
                                <div className="font-medium">
                                  {(consultation as any).user?.first_name ||
                                    "Client"}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {(consultation as any).user?.email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {(consultation as any).product?.title ||
                                "Consultation"}
                            </div>
                          </TableCell>
                          <TableCell>
                            {formatCurrency(Number(consultation.amount))}
                          </TableCell>
                          <TableCell>
                            {new Date(
                              consultation.purchased_at,
                            ).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                consultation.consultation_completed
                                  ? "default"
                                  : "secondary"
                              }
                              className="gap-1"
                            >
                              {consultation.consultation_completed ? (
                                <>
                                  <CheckCircle className="h-3 w-3" />
                                  Completed
                                </>
                              ) : (
                                <>
                                  <Clock className="h-3 w-3" />
                                  Pending
                                </>
                              )}
                            </Badge>
                            {consultation.consultation_completed_at && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Completed:{" "}
                                {new Date(
                                  consultation.consultation_completed_at,
                                ).toLocaleDateString()}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {!consultation.consultation_completed && (
                              <Button
                                size="sm"
                                onClick={() =>
                                  markConsultationComplete.mutate(
                                    consultation.id,
                                  )
                                }
                                disabled={markConsultationComplete.isPending}
                                className="gap-1 text-xs"
                              >
                                <CheckCircle className="h-3 w-3" />
                                <span className="hidden sm:inline">
                                  Mark Complete
                                </span>
                                <span className="sm:hidden">Complete</span>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-semibold">
                    No consultation bookings
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    When clients book consultations with you, they'll appear
                    here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Products</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics?.topProducts && analytics.topProducts.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.topProducts.map((product, index) => (
                      <div key={product.id} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{product.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {product.view_count || 0} views
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            {formatCurrency(product.price)}
                          </div>
                          {product.average_rating && (
                            <div className="text-sm text-muted-foreground">
                              ★ {product.average_rating.toFixed(1)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    No sales data available yet
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Performance Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Average Product Rating
                    </span>
                    <span className="font-medium">
                      {profile.expert_rating
                        ? `★ ${profile.expert_rating.toFixed(1)}`
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Total Reviews
                    </span>
                    <span className="font-medium">
                      {profile.expert_total_reviews || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Account Status
                    </span>
                    <Badge
                      variant={
                        profile.expert_verified ? "default" : "secondary"
                      }
                    >
                      {profile.expert_verified ? "Verified" : "Pending"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Consultation Rate
                    </span>
                    <span className="font-medium">
                      {profile.expert_consultation_rate
                        ? `${formatCurrency(profile.expert_consultation_rate)}/hour`
                        : "Not set"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Upload Modal */}
      <ProductUploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={handleProductUploadSuccess}
      />

      {/* Edit Modal */}
      {selectedProduct && (
        <ProductEditModal
          open={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedProduct(null);
          }}
          onSuccess={handleProductEditSuccess}
          product={selectedProduct}
        />
      )}

      {/* Preview Content Modal */}
      {selectedProduct && (
        <ContentViewer
          open={previewModalOpen}
          onClose={handleClosePreview}
          product={selectedProduct}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteProductId}
        onOpenChange={() => setDeleteProductId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this product? This will
              permanently remove the product and all associated files. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteProduct}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
