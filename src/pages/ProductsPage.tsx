import React from "react";
import { useTranslation } from "react-i18next";
import { ProductGrid } from "@/components/products/ProductGrid";

export const ProductsPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#1C3263]">{t('products.pageTitle')}</h1>
        <p className="text-black">
          {t('products.pageSubtitle')}
        </p>
      </div>

      <ProductGrid showFilters={true} />
    </div>
  );
};

