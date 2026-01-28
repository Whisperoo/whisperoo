import React, { useState, useEffect } from "react";
import { ProductCard } from "./ProductCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Grid, List, Search } from "lucide-react";
import {
  productService,
  ProductFilters,
  ProductWithDetails,
} from "@/services/products";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CardProduct } from "../content/product-card";

interface ProductGridProps {
  expertId?: string;
  initialFilters?: ProductFilters;
  showFilters?: boolean;
}

interface PaginationControlsProps {
  currentPage: number;
  totalResults: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  searchQuery?: string;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalResults,
  pageSize,
  onPageChange,
  isLoading,
  searchQuery,
}) => {
  // Don't show pagination if there's only one page or no results
  if (totalResults <= pageSize || totalResults === 0) {
    return null;
  }

  const totalPages = Math.ceil(totalResults / pageSize);

  // Calculate which page numbers to show (max 5 buttons)
  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 3) {
      return [1, 2, 3, 4, 5];
    }

    if (currentPage >= totalPages - 2) {
      return [
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

    return [
      currentPage - 2,
      currentPage - 1,
      currentPage,
      currentPage + 1,
      currentPage + 2,
    ];
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col items-center justify-center gap-4 mt-8">
      {/* Page info */}
      <div className="text-sm text-gray-600">
        Showing {(currentPage - 1) * pageSize + 1} -{" "}
        {Math.min(currentPage * pageSize, totalResults)} of {totalResults}{" "}
        results
        {searchQuery && searchQuery.trim() && ` for "${searchQuery}"`}
      </div>

      {/* Pagination buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1 || isLoading}
        >
          Previous
        </Button>

        {/* First page button if needed */}
        {pageNumbers[0] > 1 && (
          <>
            <Button
              variant={currentPage === 1 ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(1)}
              disabled={isLoading}
            >
              1
            </Button>
            {pageNumbers[0] > 2 && (
              <span className="px-2 text-gray-400">...</span>
            )}
          </>
        )}

        {/* Page number buttons */}
        {pageNumbers.map((pageNum) => (
          <Button
            key={pageNum}
            variant={currentPage === pageNum ? "default" : "outline"}
            size="sm"
            onClick={() => onPageChange(pageNum)}
            disabled={isLoading}
          >
            {pageNum}
          </Button>
        ))}

        {/* Last page button if needed */}
        {pageNumbers[pageNumbers?.length - 1] < totalPages && (
          <>
            {pageNumbers[pageNumbers?.length - 1] < totalPages - 1 && (
              <span className="px-2 text-gray-400">...</span>
            )}
            <Button
              variant={currentPage === totalPages ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(totalPages)}
              disabled={isLoading}
            >
              {totalPages}
            </Button>
          </>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || isLoading}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

export const ProductGrid: React.FC<ProductGridProps> = ({
  expertId,
  initialFilters = {},
  showFilters = true,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [filters, setFilters] = useState<ProductFilters>({
    ...initialFilters,
    expertId,
  });
  const [page, setPage] = useState(1);
  const [userPurchases, setUserPurchases] = useState<Set<string>>(new Set());

  // ✅ Fixed: Added refetch to useQuery
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["products", filters, page, searchQuery],
    queryFn: () =>
      productService.getProducts(
        {
          ...filters,
          searchQuery: searchQuery.trim() || undefined,
        },
        page,
        12,
      ),
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["product-categories"],
    queryFn: () => productService.getCategories(),
  });

  // Fetch user purchases
  useEffect(() => {
    if (user) {
      productService.getUserPurchases(user.id).then((purchases) => {
        const purchasedIds = new Set(
          purchases.map((p) => p.product_id).filter(Boolean) as string[],
        );
        setUserPurchases(purchasedIds);
      });
    }
  }, [user]);

  const displayProducts = data?.products || [];
  const totalResults = data?.total || 0;

  const handleFilterChange = (key: keyof ProductFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1); // Reset to page 1 when filters change
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Reset to page 1 when searching
    refetch(); // Trigger refetch with new search term
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setPage(1);
  };

  const handleProductView = (product: ProductWithDetails) => {
    navigate(`/products/${product.id}`);
  };

  const handleProductPurchase = (product: ProductWithDetails) => {
    navigate(`/products/${product.id}/purchase`);
  };

  const handleProductDownload = async (product: ProductWithDetails) => {
    if (!user) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-purchase`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${
              (await supabase.auth.getSession()).data.session?.access_token
            }`,
          },
          body: JSON.stringify({ product_id: product.id }),
        },
      );

      const data = await response.json();
      if (data.has_access && data.product.download_url) {
        window.open(data.product.download_url, "_blank");
      }
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  if (error) {
    // ✅ Handle 416 error specifically
    const errorMessage =
      error instanceof Error
        ? error.message.includes("Range Not Satisfiable") ||
          error.message.includes("PGRST116")
          ? "No more results available. Please go back to previous page."
          : error.message
        : "Error loading products. Please try again.";

    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{errorMessage}</p>
        <Button
          onClick={() => {
            setPage(1);
            refetch();
          }}
        >
          Go to First Page
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex md:hidden">
        <h2 className="text-[22px] font-semibold text-[#1C3263]">
          All Resources
        </h2>
        <button
          className="ml-auto"
          onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
        >
          <img src="/filter.svg" />
        </button>
      </div>
      {showFilters && (
        <div className={`space-y-4 ${!mobileFilterOpen && "hidden"} md:block `}>
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search products by title or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
            <Button type="submit">Search</Button>
          </form>

          {/* Search Results Header */}
          {searchQuery.trim() && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="font-medium text-blue-700">
                  🔍 Found {totalResults} product
                  {totalResults !== 1 ? "s" : ""} for "{searchQuery}"
                  {page > 1 && ` (Page ${page})`}
                </span>
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSearch}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Clear search
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            {/* Category Filter */}
            <Select
              value={filters.category || "all"}
              onValueChange={(value) =>
                handleFilterChange(
                  "category",
                  value === "all" ? undefined : value,
                )
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.slug}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Product Type Filter */}
            <Select
              value={filters.productType || "all"}
              onValueChange={(value) =>
                handleFilterChange(
                  "productType",
                  value === "all" ? undefined : value,
                )
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
                <SelectItem value="document">Documents</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort By */}
            <Select
              value={`${filters.sortBy || "created_at"}-${
                filters.sortOrder || "desc"
              }`}
              onValueChange={(value) => {
                const [sortBy, sortOrder] = value.split("-");
                handleFilterChange("sortBy", sortBy as any);
                handleFilterChange("sortOrder", sortOrder as any);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at-desc">Newest First</SelectItem>
                <SelectItem value="created_at-asc">Oldest First</SelectItem>
                <SelectItem value="price-asc">Price: Low to High</SelectItem>
                <SelectItem value="price-desc">Price: High to Low</SelectItem>
                <SelectItem value="rating-desc">Highest Rated</SelectItem>
                <SelectItem value="title-asc">Title: A to Z</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode Toggle */}
            <div className=" hidden ml-auto md:flex gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("grid")}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Products Grid/List */}
      {isLoading ? (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              : "space-y-4"
          }
        >
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-[400px]" />
          ))}
        </div>
      ) : (
        <>
          {/* Always use server-filtered products */}
          {displayProducts?.length > 0 ? (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  : "space-y-4"
              }
            >
              {displayProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onView={() => handleProductView(product)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              {searchQuery.trim() ? (
                <>
                  <p className="text-gray-500 font-medium mb-2">
                    No products found for "{searchQuery}"
                  </p>
                  <p className="text-sm text-gray-400 mb-4">
                    Try different keywords or check spelling
                  </p>
                  <Button variant="outline" onClick={handleClearSearch}>
                    Clear search & show all products
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground">No products found</p>
              )}
            </div>
          )}

          {/* ✅ Use PaginationControls component */}
          {displayProducts?.length > 0 && (
            <PaginationControls
              currentPage={page}
              totalResults={totalResults}
              pageSize={12}
              onPageChange={setPage}
              isLoading={isLoading}
              searchQuery={searchQuery}
            />
          )}
        </>
      )}
    </div>
  );
};
