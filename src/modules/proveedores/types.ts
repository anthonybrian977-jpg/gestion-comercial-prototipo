/** Registro base de proveedor tal como viene de la tabla `suppliers`. */
export type SupplierRecord = {
  id: string;
  name: string;
  ruc: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
};

/** Proveedor enriquecido con estadísticas calculadas para el listado. */
export type SupplierListItem = SupplierRecord & {
  /** Número de variantes de producto que este proveedor suministra. */
  variant_count: number;
  /** Número de variantes en las que este proveedor tiene el precio más bajo. */
  cheapest_count: number;
};

/** Variante de producto dentro del detalle de un proveedor. */
export type SupplierVariantItem = {
  supplier_product_id: string;
  variant_id: string;
  sku: string;
  color: string | null;
  size: string | null;
  presentation: string | null;
  product_id: string;
  product_name: string;
  product_brand: string | null;
  product_category: string | null;
  purchase_price: number;
};

/** Grupo de variantes del mismo producto padre, dentro del detalle de un proveedor. */
export type SupplierProductGroup = {
  product_id: string;
  product_name: string;
  product_brand: string | null;
  product_category: string | null;
  variants: SupplierVariantItem[];
};

/** Detalle completo de un proveedor con sus productos agrupados. */
export type SupplierDetail = SupplierRecord & {
  groups: SupplierProductGroup[];
};
