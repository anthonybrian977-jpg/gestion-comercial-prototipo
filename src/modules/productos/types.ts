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
  /** UUID del supplier_products preferido (legacy — usar preferred_catalog_item_id) */
  preferred_supplier_product_id: string | null;
  /** UUID del supplier_catalog_items seleccionado como proveedor de compra */
  preferred_catalog_item_id: string | null;
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
  /** UUID del supplier_catalog_items seleccionado como proveedor de compra para esta variante */
  preferredCatalogItemId?: string | null;
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

/** Precio de compra de una variante según un proveedor concreto (lee supplier_catalog_items). */
export type VariantSupplierPrice = {
  /** PK de supplier_catalog_items */
  catalog_item_id: string;
  variant_id: string;
  supplier_id: string;
  supplier_name: string;
  purchase_price: number;
};
