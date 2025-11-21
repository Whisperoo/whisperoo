import React, { useState, useEffect } from 'react';
import { ProductCard } from './ProductCard';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Grid, List, Search, Filter } from 'lucide-react';
import { productService, ProductFilters, ProductWithDetails } from '@/services/products';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

interface ProductGridProps {
  expertId?: string;
  initialFilters?: ProductFilters;
  showFilters?: boolean;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  expertId,
  initialFilters = {},
  showFilters = true,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ProductFilters>({
    ...initialFilters,
    expertId,
  });
  const [page, setPage] = useState(1);
  const [userPurchases, setUserPurchases] = useState<Set<string>>(new Set());

  // Fetch products
  const { data, isLoading, error } = useQuery({
    queryKey: ['products', filters, page],
    queryFn: () => productService.getProducts(filters, page, 12),
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['product-categories'],
    queryFn: () => productService.getCategories(),
  });

  // Fetch user purchases
  useEffect(() => {
    if (user) {
      productService.getUserPurchases(user.id).then((purchases) => {
        const purchasedIds = new Set(purchases.map(p => p.product_id).filter(Boolean) as string[]);
        setUserPurchases(purchasedIds);
      });
    }
  }, [user]);

  const handleFilterChange = (key: keyof ProductFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real implementation, you'd add search to the filters
    console.log('Search:', searchQuery);
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
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ product_id: product.id }),
      });
      
      const data = await response.json();
      if (data.has_access && data.product.download_url) {
        window.open(data.product.download_url, '_blank');
      }
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const totalPages = Math.ceil((data?.total || 0) / 12);

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Error loading products. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showFilters && (
        <div className="space-y-4">
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            {/* Category Filter */}
            <Select
              value={filters.category || 'all'}
              onValueChange={(value) => handleFilterChange('category', value === 'all' ? undefined : value)}
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
              value={filters.productType || 'all'}
              onValueChange={(value) => handleFilterChange('productType', value === 'all' ? undefined : value)}
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
              value={`${filters.sortBy || 'created_at'}-${filters.sortOrder || 'desc'}`}
              onValueChange={(value) => {
                const [sortBy, sortOrder] = value.split('-');
                handleFilterChange('sortBy', sortBy as any);
                handleFilterChange('sortOrder', sortOrder as any);
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
            <div className="ml-auto flex gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Products Grid/List */}
      {isLoading ? (
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' 
          : 'space-y-4'
        }>
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-[400px]" />
          ))}
        </div>
      ) : (
        <>
          {data?.products && data.products.length > 0 ? (
            <div className={viewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' 
              : 'space-y-4'
            }>
              {data.products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onView={() => handleProductView(product)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No products found</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-2">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  const pageNum = i + 1;
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};