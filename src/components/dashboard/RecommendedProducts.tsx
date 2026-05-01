import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/products/ProductCard";
import { productService, ProductWithDetails } from "@/services/products";
import { usePersonalizedSort } from "@/hooks/usePersonalizedSort";

export const RecommendedProducts: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sortPersonalized } = usePersonalizedSort();
  
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoading(true);
      try {
        // Fetch latest products
        const { products: fetched } = await productService.getProducts({}, 1, 20);
        // Apply AI/RAG-based personalized sorting
        const sorted = sortPersonalized(fetched);
        // Take top 3 for dashboard
        setProducts(sorted.slice(0, 3));
      } catch (error) {
        console.error("Failed to load recommended products", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRecommendations();
  }, [sortPersonalized]);

  if (loading) {
    return (
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <h2 className="text-xl font-bold text-gray-900">Recommended for You</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 bg-gray-100 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <div className="mb-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          <h2 className="text-xl font-bold text-gray-900">Recommended for You</h2>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
          onClick={() => navigate('/products')}
        >
          View All <ArrowRight className="ml-1 w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <div key={product.id} className="h-full">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecommendedProducts;
