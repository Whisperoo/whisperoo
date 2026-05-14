import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/products/ProductCard";
import { productService, ProductWithDetails } from "@/services/products";
import { usePersonalizedSort } from "@/hooks/usePersonalizedSort";
import { useAuth } from '@/contexts/AuthContext';

export const RecommendedProducts: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sortPersonalized } = usePersonalizedSort();
  const { profile } = useAuth();

  // Stable string key — only changes when the user's topic selections actually change.
  const profileTopicsKey = useMemo(
    () => JSON.stringify(profile?.topics_of_interest ?? []),
    [profile?.topics_of_interest],
  );

  const [rawProducts, setRawProducts] = useState<ProductWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoad = useRef(true);

  // Fetch raw products only when topic selections change (or on mount).
  // sortPersonalized is intentionally NOT a dependency here — sorting is
  // handled separately as derived state so that a function identity change
  // never triggers a redundant network round-trip.
  useEffect(() => {
    let cancelled = false;
    if (initialLoad.current) setLoading(true);
    productService.getProducts({}, 1, 100)
      .then(({ products: fetched }) => {
        if (!cancelled) {
          setRawProducts(fetched);
          setLoading(false);
          initialLoad.current = false;
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load recommended products", err);
          setLoading(false);
          initialLoad.current = false;
        }
      });
    return () => { cancelled = true; };
  }, [profileTopicsKey]); // no sortPersonalized — breaks the re-render cycle

  // Sort is pure derived state: no state mutation, no network call.
  // Even if sortPersonalized identity changes, this just re-sorts in memory.
  const products = useMemo(
    () => sortPersonalized(rawProducts).slice(0, 3),
    [rawProducts, sortPersonalized],
  );

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

  if (!loading && products.length === 0) {
    return (
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <h2 className="text-xl font-bold text-gray-900">Recommended for You</h2>
          </div>
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
          No personalized recommendations are available yet. Explore expert resources to get tailored suggestions.
        </div>
      </div>
    );
  }

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
