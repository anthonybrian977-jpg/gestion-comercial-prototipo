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
  image_path: string | null;
};

export type ProductRecord = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  description: string | null;
  main_sku: string | null;
  image_path: string | null;
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

export type CreateVariantInput = {
  sku?: string;
  presentation?: string;
  color?: string;
  size?: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  status: string;
  imagePath?: string;
};

export type CreateProductInput = {
  name: string;
  brand?: string;
  model?: string;
  category?: string;
  description?: string;
  mainSku?: string;
  imagePath?: string;
  hasVariants: boolean;
  status: string;
  variants: CreateVariantInput[];
};

export type UpdateVariantInput = {
  id: string;
  sku: string;
  presentation?: string;
  color?: string;
  size?: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  status: string;
  imagePath?: string;
};

export type NewVariantForUpdate = {
  sku?: string;
  presentation?: string;
  color?: string;
  size?: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  status: string;
  imagePath?: string;
};

export type UpdateProductInput = {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  category?: string;
  description?: string;
  mainSku: string;
  imagePath?: string;
  status: string;
  variants: UpdateVariantInput[];
  newVariants?: NewVariantForUpdate[];
};

/** Precio de compra de una variante según un proveedor concreto. */
export type VariantSupplierPrice = {
  variant_id: string;
  supplier_id: string;
  supplier_name: string;
  purchase_price: number;
  /** true si este es el precio más bajo entre todos los proveedores para esa variante. */
  is_best: boolean;
};
