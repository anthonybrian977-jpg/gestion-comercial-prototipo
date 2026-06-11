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
  /** Total de productos en el catálogo del proveedor. */
  catalog_count: number;
  /** Productos del catálogo ya importados al Maestro. */
  imported_count: number;
  /** Productos del catálogo pendientes de importar. */
  pending_count: number;
};

/** Variante de producto dentro del detalle de un proveedor. */
export type SupplierVariantItem = {
  supplier_product_id: string;
  variant_id: string;
  sku: string;
  /** Código interno del proveedor para esta variante (opcional). */
  supplier_sku: string | null;
  color: string | null;
  size: string | null;
  presentation: string | null;
  product_id: string;
  product_name: string;
  product_brand: string | null;
  product_category: string | null;
  purchase_price: number;
  /** Si false, el precio de este proveedor está desactivado. */
  is_active: boolean;
};

/** Grupo de variantes del mismo producto padre, dentro del detalle de un proveedor. */
export type SupplierProductGroup = {
  product_id: string;
  product_name: string;
  product_brand: string | null;
  product_category: string | null;
  variants: SupplierVariantItem[];
};

/** Item del catálogo de un proveedor (puede no existir en el Maestro). */
export type SupplierCatalogItem = {
  id: string;
  supplier_id: string;
  supplier_sku: string | null;
  product_name: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  presentation: string | null;
  color: string | null;
  size: string | null;
  purchase_price: number;
  is_active: boolean;
  linked_product_id: string | null;
  linked_variant_id: string | null;
  imported_to_master: boolean;
  created_at: string;
  updated_at: string;
};

/** Detalle completo de un proveedor con su catálogo. */
export type SupplierDetail = SupplierRecord & {
  /** Catálogo de productos del proveedor (tabla supplier_catalog_items). */
  catalog: SupplierCatalogItem[];
};
