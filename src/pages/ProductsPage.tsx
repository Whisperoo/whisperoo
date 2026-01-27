import React from "react";
import { ProductGrid } from "@/components/products/ProductGrid";

export const ProductsPage: React.FC = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#1C3263]">Expert Products</h1>
        <p className="text-black">
          Discover digital resources from our verified parenting experts
        </p>
      </div>

      <ProductGrid showFilters={true} />
    </div>
  );
};
