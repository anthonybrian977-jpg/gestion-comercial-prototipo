export type ProductVariant = {
  id: string;
  product_id: string;
  sku: string;
  size: string | null;
  color: string | null;
  presentation: string | null;
  purchase_price: number | null;
  sale_price: number | null;
  stock: number;
  min_stock: number;
  status: string;
};

export type ProductRecord = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  description: string | null;
  main_sku: string | null;
  image_url: string | null;
  has_variants: boolean;
  status: string;
};

export type ProductListItem = ProductRecord & {
  priceFrom: number | null;
  totalStock: number;
  activeVariantCount: number;
  variants: ProductVariant[];
  hasLowStock: boolean;
};
